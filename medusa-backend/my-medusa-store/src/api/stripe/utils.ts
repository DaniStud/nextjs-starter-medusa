/**
 * Stripe Payment Utilities
 * 
 * Helper functions for Stripe payment operations and webhook processing
 */

import Stripe from "stripe"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Find payment collection by Stripe payment intent ID
 */
export async function findPaymentCollectionByStripeId(
  paymentIntentId: string,
  container: any
) {
  const paymentModule = container.resolve(Modules.PAYMENT)
  
  const paymentCollections = await paymentModule.listPaymentCollections({
    metadata: {
      stripe_payment_intent_id: paymentIntentId
    }
  })

  return paymentCollections && paymentCollections.length > 0 
    ? paymentCollections[0] 
    : null
}

/**
 * Find order by payment collection ID
 */
export async function findOrderByPaymentCollectionId(
  paymentCollectionId: string,
  container: any
) {
  const orderModule = container.resolve(Modules.ORDER)
  
  const orders = await orderModule.listOrders({
    payment_collection_id: paymentCollectionId
  })

  return orders && orders.length > 0 ? orders[0] : null
}

/**
 * Capture payment in Medusa
 */
export async function capturePaymentInMedusa(
  paymentId: string,
  container: any
) {
  const paymentModule = container.resolve(Modules.PAYMENT)
  
  await paymentModule.capturePayment({
    payment_id: paymentId,
    captured_by: "stripe_webhook"
  })
}

/**
 * Update order payment status
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: "captured" | "failed" | "refunded",
  container: any
) {
  const orderModule = container.resolve(Modules.ORDER)
  
  await orderModule.updateOrders({
    id: orderId,
    payment_status: paymentStatus
  })
}

/**
 * Convert Stripe amount (cents) to currency unit
 */
export function convertStripeCentsToAmount(cents: number): number {
  return cents / 100
}

/**
 * Log payment event with context
 */
export function logPaymentEvent(
  eventType: string,
  paymentId: string,
  details: Record<string, any>,
  container: any
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  
  logger.info(`[Stripe Payment] ${eventType}`, {
    payment_id: paymentId,
    ...details,
    timestamp: new Date().toISOString()
  })
}

/**
 * Extract error details from Stripe payment intent
 */
export function extractStripeErrorDetails(paymentIntent: Stripe.PaymentIntent) {
  const error = paymentIntent.last_payment_error
  
  if (!error) {
    return null
  }

  return {
    message: error.message || "Payment failed",
    code: error.code,
    decline_code: error.decline_code,
    type: error.type,
    param: error.param
  }
}

/**
 * Check if webhook event should be processed (idempotency)
 */
export class WebhookEventTracker {
  private static processedEvents = new Set<string>()
  private static readonly MAX_EVENTS = 1000

  static isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId)
  }

  static markAsProcessed(eventId: string): void {
    this.processedEvents.add(eventId)
    
    // Clean up old events
    if (this.processedEvents.size > this.MAX_EVENTS) {
      const sorted = Array.from(this.processedEvents)
      sorted.slice(0, sorted.length - this.MAX_EVENTS).forEach(id => 
        this.processedEvents.delete(id)
      )
    }
  }

  static reset(): void {
    this.processedEvents.clear()
  }
}
