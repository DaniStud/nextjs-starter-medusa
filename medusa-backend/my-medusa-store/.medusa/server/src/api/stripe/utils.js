"use strict";
/**
 * Stripe Payment Utilities
 *
 * Helper functions for Stripe payment operations and webhook processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventTracker = void 0;
exports.findPaymentCollectionByStripeId = findPaymentCollectionByStripeId;
exports.findOrderByPaymentCollectionId = findOrderByPaymentCollectionId;
exports.capturePaymentInMedusa = capturePaymentInMedusa;
exports.updateOrderPaymentStatus = updateOrderPaymentStatus;
exports.convertStripeCentsToAmount = convertStripeCentsToAmount;
exports.logPaymentEvent = logPaymentEvent;
exports.extractStripeErrorDetails = extractStripeErrorDetails;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Find payment collection by Stripe payment intent ID
 */
async function findPaymentCollectionByStripeId(paymentIntentId, container) {
    const paymentModule = container.resolve(utils_1.Modules.PAYMENT);
    const paymentCollections = await paymentModule.listPaymentCollections({
        metadata: {
            stripe_payment_intent_id: paymentIntentId
        }
    });
    return paymentCollections && paymentCollections.length > 0
        ? paymentCollections[0]
        : null;
}
/**
 * Find order by payment collection ID
 */
async function findOrderByPaymentCollectionId(paymentCollectionId, container) {
    const orderModule = container.resolve(utils_1.Modules.ORDER);
    const orders = await orderModule.listOrders({
        payment_collection_id: paymentCollectionId
    });
    return orders && orders.length > 0 ? orders[0] : null;
}
/**
 * Capture payment in Medusa
 */
async function capturePaymentInMedusa(paymentId, container) {
    const paymentModule = container.resolve(utils_1.Modules.PAYMENT);
    await paymentModule.capturePayment({
        payment_id: paymentId,
        captured_by: "stripe_webhook"
    });
}
/**
 * Update order payment status
 */
async function updateOrderPaymentStatus(orderId, paymentStatus, container) {
    const orderModule = container.resolve(utils_1.Modules.ORDER);
    await orderModule.updateOrders({
        id: orderId,
        payment_status: paymentStatus
    });
}
/**
 * Convert Stripe amount (cents) to currency unit
 */
function convertStripeCentsToAmount(cents) {
    return cents / 100;
}
/**
 * Log payment event with context
 */
function logPaymentEvent(eventType, paymentId, details, container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    logger.info(`[Stripe Payment] ${eventType}`, {
        payment_id: paymentId,
        ...details,
        timestamp: new Date().toISOString()
    });
}
/**
 * Extract error details from Stripe payment intent
 */
function extractStripeErrorDetails(paymentIntent) {
    const error = paymentIntent.last_payment_error;
    if (!error) {
        return null;
    }
    return {
        message: error.message || "Payment failed",
        code: error.code,
        decline_code: error.decline_code,
        type: error.type,
        param: error.param
    };
}
/**
 * Check if webhook event should be processed (idempotency)
 */
class WebhookEventTracker {
    static isProcessed(eventId) {
        return this.processedEvents.has(eventId);
    }
    static markAsProcessed(eventId) {
        this.processedEvents.add(eventId);
        // Clean up old events
        if (this.processedEvents.size > this.MAX_EVENTS) {
            const sorted = Array.from(this.processedEvents);
            sorted.slice(0, sorted.length - this.MAX_EVENTS).forEach(id => this.processedEvents.delete(id));
        }
    }
    static reset() {
        this.processedEvents.clear();
    }
}
exports.WebhookEventTracker = WebhookEventTracker;
WebhookEventTracker.processedEvents = new Set();
WebhookEventTracker.MAX_EVENTS = 1000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0cmlwZS91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBUUgsMEVBZUM7QUFLRCx3RUFXQztBQUtELHdEQVVDO0FBS0QsNERBV0M7QUFLRCxnRUFFQztBQUtELDBDQWFDO0FBS0QsOERBY0M7QUEvR0QscURBQThFO0FBRTlFOztHQUVHO0FBQ0ksS0FBSyxVQUFVLCtCQUErQixDQUNuRCxlQUF1QixFQUN2QixTQUFjO0lBRWQsTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7SUFFeEQsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQztRQUNwRSxRQUFRLEVBQUU7WUFDUix3QkFBd0IsRUFBRSxlQUFlO1NBQzFDO0tBQ0YsQ0FBQyxDQUFBO0lBRUYsT0FBTyxrQkFBa0IsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQztRQUN4RCxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLENBQUMsQ0FBQyxJQUFJLENBQUE7QUFDVixDQUFDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsOEJBQThCLENBQ2xELG1CQUEyQixFQUMzQixTQUFjO0lBRWQsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsS0FBSyxDQUFDLENBQUE7SUFFcEQsTUFBTSxNQUFNLEdBQUcsTUFBTSxXQUFXLENBQUMsVUFBVSxDQUFDO1FBQzFDLHFCQUFxQixFQUFFLG1CQUFtQjtLQUMzQyxDQUFDLENBQUE7SUFFRixPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUE7QUFD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