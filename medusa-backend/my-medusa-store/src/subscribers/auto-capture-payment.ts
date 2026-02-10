import type { SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/**
 * Auto-capture Stripe payments when order is created
 * 
 * This subscriber listens for order creation events and automatically
 * captures authorized payments, eliminating the need for manual capture.
 */
export default async function autoCapturePaymentHandler({ event, container }: any) {
  const logger = container.resolve("logger")
  const paymentModule = container.resolve(Modules.PAYMENT)
  
  const { id: orderId } = event.data

  try {
    logger.info(`[Auto-Capture] Order ${orderId} created, capturing authorized payments`)

    // List all payments - we'll filter to recent ones
    const allPayments = await paymentModule.listPayments({})
    
    // Get timestamp of 1 minute ago (only capture very recent payments)
    const oneMinuteAgo = new Date(Date.now() - 60000)

    let capturedCount = 0

    for (const payment of allPayments) {
      // Skip if already captured
      if (payment.captured_at) {
        continue
      }

      // Skip if not Stripe
      if (payment.provider_id !== 'pp_stripe_stripe') {
        continue
      }

      // Only capture payments created in the last minute (related to current order)
      const paymentCreatedAt = new Date(payment.created_at)
      if (paymentCreatedAt < oneMinuteAgo) {
        continue
      }

      try {
        logger.info(`[Auto-Capture] Capturing payment ${payment.id} (amount: ${payment.amount})`)
        
        await paymentModule.capturePayment({
          payment_id: payment.id
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
      logger.info(`[Auto-Capture] No recent uncaptured Stripe payments found for order ${orderId}`)
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
