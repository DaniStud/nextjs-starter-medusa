import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Stripe from "stripe"
import { WebhookEventTracker } from "../utils"

const stripe = new Stripe(process.env.STRIPE_API_KEY || "")
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sig = req.headers["stripe-signature"] as string | undefined
  const expressReq = req as any
  
  // Get raw body for signature verification (needed for production)
  let rawBody: Buffer
  
  if (expressReq.rawBody && Buffer.isBuffer(expressReq.rawBody)) {
    rawBody = expressReq.rawBody
  } else if (typeof expressReq.rawBody === 'string') {
    rawBody = Buffer.from(expressReq.rawBody, 'utf8')
  } else if (Buffer.isBuffer(expressReq.body)) {
    rawBody = expressReq.body
  } else if (typeof expressReq.body === 'string') {
    rawBody = Buffer.from(expressReq.body, 'utf8')
  } else {
    // Body already parsed - signature verification will fail
    rawBody = Buffer.from(JSON.stringify(expressReq.body), 'utf8')
  }

  let event: Stripe.Event
  
  const IS_LOCAL_DEV = process.env.NODE_ENV === 'development'
  
  if (IS_LOCAL_DEV) {
    console.warn("[Stripe Webhook] ⚠️ Local dev mode - skipping signature verification")
    event = req.body as Stripe.Event
  } else {
    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
        console.log("[Stripe Webhook] ✅ Signature verified successfully")
      } else {
        console.error("[Stripe Webhook] ❌ Missing webhook secret or signature in production")
        return res.status(400).send("Webhook Error: Missing signature or secret")
      }
    } catch (err) {
      console.error("[Stripe Webhook] ❌ Signature verification failed:", (err as Error).message)
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }
  }

  // Idempotency check via Redis (with in-memory fallback)
  if (await WebhookEventTracker.isProcessed(event.id)) {
    console.info(`[Stripe Webhook] Event ${event.id} already processed, skipping`)
    return res.json({ received: true, status: "duplicate" })
  }

  try {
    const container = req.scope

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, container)
        break
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge
        if (typeof charge.payment_intent === 'string') {
          const pi = await stripe.paymentIntents.retrieve(charge.payment_intent)
          await handlePaymentIntentSucceeded(pi, container)
        }
        break
      }
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, container)
        break
      case "payment_intent.requires_action":
        await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent, container)
        break
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent, container)
        break
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge, container)
        break
      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute, container)
        break
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, container)
        break
      default:
        console.info(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    // Mark as processed in Redis
    await WebhookEventTracker.markAsProcessed(event.id)
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err)
    return res.status(500).send()
  }

  return res.json({ received: true })
}

/**
 * Handle successful payment intent
 * 
 * Note: For standard card payments with automatic capture, Medusa's cart.complete
 * already handles payment capture. This webhook mainly serves to:
 * - Log successful payments for debugging
 * - Handle async payment methods that complete later
 * - Sync payment status for edge cases
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, container: any) {
  console.info(`[Stripe Webhook] payment_intent.succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}, status: ${paymentIntent.status}`)

  try {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    // For most card payments, Medusa already captured during cart.complete
    // This webhook arrives before/during order creation, so payment may not exist yet
    logger.info(`[Stripe Webhook] Payment successful in Stripe for ${paymentIntent.id}`)
    logger.info(`[Stripe Webhook] Note: Standard card payments are auto-captured by Medusa during checkout`)
    
    // If this is an async payment method (bank transfer, etc.), we would handle it here
    // For now, just log success
    
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing payment_intent.succeeded:`, error)
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, container: any) {
  console.warn(`[Stripe Webhook] payment_intent.payment_failed: ${paymentIntent.id}`)

  try {
    const paymentModule = container.resolve(Modules.PAYMENT)
    const orderModule = container.resolve(Modules.ORDER)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    // Find payment collection
    const paymentCollections = await paymentModule.listPaymentCollections({
      metadata: {
        stripe_payment_intent_id: paymentIntent.id
      }
    })

    if (!paymentCollections || paymentCollections.length === 0) {
      logger.warn(`[Stripe Webhook] No payment collection found for failed payment_intent ${paymentIntent.id}`)
      return
    }

    const paymentCollection = paymentCollections[0]
    const payments = await paymentModule.listPayments({
      payment_collection_id: paymentCollection.id
    })

    if (payments && payments.length > 0) {
      const payment = payments[0]

      // Update payment status to failed
      await paymentModule.updatePayments({
        id: payment.id,
        data: {
          metadata: {
            stripe_error: paymentIntent.last_payment_error?.message || "Payment failed",
            stripe_error_code: paymentIntent.last_payment_error?.code,
            stripe_decline_code: paymentIntent.last_payment_error?.decline_code
          }
        }
      })

      logger.info(`[Stripe Webhook] Payment ${payment.id} marked as failed`)

      // Update associated order
      const orders = await orderModule.listOrders({
        payment_collection_id: paymentCollection.id
      })

      if (orders && orders.length > 0) {
        const order = orders[0]
        
        await orderModule.updateOrders({
          id: order.id,
          payment_status: "failed"
        })

        logger.info(`[Stripe Webhook] Order ${order.id} payment marked as failed`)

        // TODO: Notify customer of payment failure
        // const notificationModule = container.resolve(Modules.NOTIFICATION)
        // await notificationModule.createNotifications({...})
      }
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing payment_intent.payment_failed:`, error)
    throw error
  }
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge, container: any) {
  console.info(`[Stripe Webhook] charge.refunded: ${charge.id}`)

  try {
    const paymentModule = container.resolve(Modules.PAYMENT)
    const orderModule = container.resolve(Modules.ORDER)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    // Find payment by charge ID (may be in metadata or payment_intent)
    const paymentIntent = charge.payment_intent as string
    
    if (!paymentIntent) {
      logger.warn(`[Stripe Webhook] No payment_intent linked to charge ${charge.id}`)
      return
    }

    const paymentCollections = await paymentModule.listPaymentCollections({
      metadata: {
        stripe_payment_intent_id: paymentIntent
      }
    })

    if (!paymentCollections || paymentCollections.length === 0) {
      logger.warn(`[Stripe Webhook] No payment collection found for charge ${charge.id}`)
      return
    }

    const paymentCollection = paymentCollections[0]
    const payments = await paymentModule.listPayments({
      payment_collection_id: paymentCollection.id
    })

    if (payments && payments.length > 0) {
      const payment = payments[0]

      // Create refund record in Medusa
      // Note: Stripe refund amount is in cents; Medusa may expect different format
      const refundAmount = charge.amount_refunded / 100 // Convert cents to currency unit

      // TODO: Use proper refund workflow when available
      await paymentModule.updatePayments({
        id: payment.id,
        data: {
          metadata: {
            stripe_refunded: true,
            stripe_refund_amount: refundAmount,
            stripe_refund_date: new Date().toISOString()
          }
        }
      })

      logger.info(`[Stripe Webhook] Payment ${payment.id} refunded: ${refundAmount}`)

      // Update order status
      const orders = await orderModule.listOrders({
        payment_collection_id: paymentCollection.id
      })

      if (orders && orders.length > 0) {
        const order = orders[0]
        
        await orderModule.updateOrders({
          id: order.id,
          payment_status: "refunded",
          status: "refunded"
        })

        logger.info(`[Stripe Webhook] Order ${order.id} marked as refunded`)

        // TODO: Send refund confirmation email
      }
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing charge.refunded:`, error)
    throw error
  }
}

/**
 * Handle checkout session completed (for payment links, etc.)
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, container: any) {
  console.info(`[Stripe Webhook] checkout.session.completed: ${session.id}`)

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  
  logger.info(`[Stripe Webhook] Checkout session completed: ${session.id}, payment_intent: ${session.payment_intent}`)
}

/**
 * Handle payment intent requiring 3D Secure / SCA action.
 * This is informational — the client-side handles the actual authentication flow.
 */
async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent, container: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`[Stripe Webhook] payment_intent.requires_action: ${paymentIntent.id} — awaiting customer authentication (3D Secure)`)
}

/**
 * Handle canceled payment intent.
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent, container: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.warn(`[Stripe Webhook] payment_intent.canceled: ${paymentIntent.id}, reason: ${paymentIntent.cancellation_reason || "unknown"}`)
}

/**
 * Handle charge dispute created (fraud alert).
 */
async function handleChargeDisputeCreated(dispute: Stripe.Dispute, container: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.error(`[Stripe Webhook] ⚠️ DISPUTE CREATED: ${dispute.id}, amount: ${dispute.amount}, reason: ${dispute.reason}, charge: ${dispute.charge}`)
  // In production, this should trigger an alert to the store owner
  // Consider integrating with email/Slack notifications here
}
