/**
 * Alternative Stripe Webhook Handler (Express-style middleware)
 * 
 * NOTE: This is an alternative implementation. The primary webhook handler is:
 * src/api/stripe/webhook/route.ts
 * 
 * Use this file if you prefer Express middleware pattern or need to integrate
 * with existing Express-based webhook infrastructure.
 */
import { NextFunction, Request, Response } from "express"
import Stripe from "stripe"

const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripe = new Stripe(process.env.STRIPE_API_KEY || "", { apiVersion: "2022-11-15" })

// Idempotency tracker
const processedEvents = new Set<string>()

export default async function handler(req: Request, res: Response, next: NextFunction) {
  const sig = req.headers["stripe-signature"] as string | undefined
  let event: Stripe.Event

  try {
    if (stripeSecret && sig) {
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, stripeSecret)
    } else {
      // Fallback: parse body directly (insecure for production)
      console.warn("[Stripe Webhook] WARNING: No webhook secret configured, skipping signature verification")
      event = req.body as Stripe.Event
    }
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err)
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
  }

  // Idempotency check
  if (processedEvents.has(event.id)) {
    console.info(`[Stripe Webhook] Event ${event.id} already processed, skipping`)
    return res.json({ received: true, status: "duplicate" })
  }

  try {
    // Access Medusa container from request scope
    const container = (req as any).scope

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent
        console.info(`[Stripe Webhook] payment_intent.succeeded: ${pi.id}`)
        
        // Business logic implementation (same as route.ts)
        // See src/api/stripe/webhook/route.ts for full implementation
        // This is a simplified version for reference
        
        console.log(`[Stripe Webhook] TODO: Implement payment capture logic for ${pi.id}`)
        break
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent
        console.warn(`[Stripe Webhook] payment_intent.payment_failed: ${pi.id}`)
        console.log(`[Stripe Webhook] Error: ${pi.last_payment_error?.message}`)
        break
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        console.info(`[Stripe Webhook] charge.refunded: ${charge.id}`)
        console.log(`[Stripe Webhook] Refund amount: ${charge.amount_refunded / 100}`)
        break
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        console.info(`[Stripe Webhook] checkout.session.completed: ${session.id}`)
        break
      }
      default:
        console.info(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    // Mark as processed
    processedEvents.add(event.id)

    // Clean up old events
    if (processedEvents.size > 1000) {
      const sorted = Array.from(processedEvents)
      sorted.slice(0, sorted.length - 1000).forEach(id => processedEvents.delete(id))
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err)
    return res.status(500).send()
  }

  res.json({ received: true })
}
