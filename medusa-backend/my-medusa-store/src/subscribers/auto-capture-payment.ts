import type { SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Auto-capture Stripe payments when order is created
 *
 * This subscriber listens for order creation events and automatically
 * captures authorized payments scoped to the specific order.
 */
export default async function autoCapturePaymentHandler({ event, container }: any) {
  const logger = container.resolve("logger")
  const paymentModule = container.resolve(Modules.PAYMENT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { id: orderId } = event.data

  try {
    logger.info(`[Auto-Capture] Order ${orderId} created, capturing authorized payments`)

    // Resolve order → payment_collection via Query (remote link)
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "payment_collection.id"],
      filters: { id: orderId },
    })

    if (!order?.payment_collection?.id) {
      logger.warn(`[Auto-Capture] No payment collection found for order ${orderId}`)
      return
    }

    const paymentCollectionId = order.payment_collection.id

    // List only payments belonging to this order's payment collection
    const payments = await paymentModule.listPayments({
      payment_collection_id: paymentCollectionId,
    })

    let capturedCount = 0

    for (const payment of payments) {
      if (payment.captured_at) continue
      if (payment.provider_id !== "pp_stripe_stripe") continue

      try {
        logger.info(`[Auto-Capture] Capturing payment ${payment.id} (amount: ${payment.amount})`)

        await paymentModule.capturePayment({
          payment_id: payment.id,
        })

        capturedCount++
        logger.info(`[Auto-Capture] ✅ Payment ${payment.id} captured successfully`)
      } catch (captureErr: any) {
        logger.error(`[Auto-Capture] ❌ Failed to capture payment ${payment.id}: ${captureErr.message}`)
      }
    }

    if (capturedCount > 0) {
      logger.info(`[Auto-Capture] ✅ Captured ${capturedCount} payment(s) for order ${orderId}`)
    } else {
      logger.info(`[Auto-Capture] No uncaptured Stripe payments found for order ${orderId}`)
    }
  } catch (error: any) {
    logger.error(`[Auto-Capture] Error in auto-capture handler: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "auto-capture-payment-handler",
  },
}
