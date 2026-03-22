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
 * Redis-based webhook event idempotency tracker.
 * Events are stored with a 24-hour TTL so they auto-expire.
 * Falls back to in-memory Set if Redis is unavailable.
 */

import Redis from "ioredis"

const REDIS_KEY_PREFIX = "stripe:webhook:event:"
const EVENT_TTL_SECONDS = 86400 // 24 hours

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    redis.connect().catch(() => {
      console.warn("[Stripe Utils] Redis connection failed, using in-memory fallback")
      redis = null
    })
    return redis
  } catch {
    return null
  }
}

// In-memory fallback
const fallbackSet = new Set<string>()
const FALLBACK_MAX = 1000

export class WebhookEventTracker {
  static async isProcessed(eventId: string): Promise<boolean> {
    const client = getRedis()
    if (client) {
      try {
        const exists = await client.exists(`${REDIS_KEY_PREFIX}${eventId}`)
        return exists === 1
      } catch {
        return fallbackSet.has(eventId)
      }
    }
    return fallbackSet.has(eventId)
  }

  static async markAsProcessed(eventId: string): Promise<void> {
    const client = getRedis()
    if (client) {
      try {
        await client.set(`${REDIS_KEY_PREFIX}${eventId}`, "1", "EX", EVENT_TTL_SECONDS)
        return
      } catch {
        // fall through to in-memory
      }
    }
    fallbackSet.add(eventId)
    if (fallbackSet.size > FALLBACK_MAX) {
      const arr = Array.from(fallbackSet)
      arr.slice(0, arr.length - FALLBACK_MAX).forEach(id => fallbackSet.delete(id))
    }
  }
}
