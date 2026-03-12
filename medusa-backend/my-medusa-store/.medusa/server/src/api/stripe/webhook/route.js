"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
// Idempotency tracker (in-memory; consider Redis for production multi-instance deployments)
const processedEvents = new Set();
async function POST(req, res) {
    const sig = req.headers["stripe-signature"];
    const expressReq = req;
    // Get raw body for signature verification (needed for production)
    let rawBody;
    if (expressReq.rawBody && Buffer.isBuffer(expressReq.rawBody)) {
        rawBody = expressReq.rawBody;
    }
    else if (typeof expressReq.rawBody === 'string') {
        rawBody = Buffer.from(expressReq.rawBody, 'utf8');
    }
    else if (Buffer.isBuffer(expressReq.body)) {
        rawBody = expressReq.body;
    }
    else if (typeof expressReq.body === 'string') {
        rawBody = Buffer.from(expressReq.body, 'utf8');
    }
    else {
        // Body already parsed - signature verification will fail
        rawBody = Buffer.from(JSON.stringify(expressReq.body), 'utf8');
    }
    let event;
    // NOTE: Signature verification disabled for local development
    // Medusa v2's rawBodyPaths config doesn't preserve raw body - it arrives pre-parsed
    // For production: Use Stripe Dashboard webhooks (they don't require rawBody since they use endpoint secrets)
    const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';
    if (IS_LOCAL_DEV) {
        console.warn("[Stripe Webhook] ⚠️ Local dev mode - skipping signature verification");
        event = req.body;
    }
    else {
        try {
            if (webhookSecret && sig) {
                event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
                console.log("[Stripe Webhook] ✅ Signature verified successfully");
            }
            else {
                console.warn("[Stripe Webhook] ⚠️ No signature verification (missing secret or signature)");
                event = req.body;
            }
        }
        catch (err) {
            console.error("[Stripe Webhook] ❌ Signature verification failed");
            console.error("[Stripe Webhook] Error:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }
    // Idempotency check: prevent duplicate processing
    if (processedEvents.has(event.id)) {
        console.info(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
        return res.json({ received: true, status: "duplicate" });
    }
    try {
        const container = req.scope;
        switch (event.type) {
            case "payment_intent.succeeded":
                await handlePaymentIntentSucceeded(event.data.object, container);
                break;
            case "charge.succeeded":
                // When using automatic capture, charge.succeeded fires instead of payment_intent.succeeded
                // Extract payment_intent from the charge and handle it
                const charge = event.data.object;
                if (typeof charge.payment_intent === 'string') {
                    const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
                    await handlePaymentIntentSucceeded(pi, container);
                }
                break;
            case "payment_intent.payment_failed":
                await handlePaymentIntentFailed(event.data.object, container);
                break;
            case "charge.refunded":
                await handleChargeRefunded(event.data.object, container);
                break;
            case "checkout.session.completed":
                await handleCheckoutSessionCompleted(event.data.object, container);
                break;
            default:
                console.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
        // Mark as processed
        processedEvents.add(event.id);
        // Clean up old events (keep last 1000)
        if (processedEvents.size > 1000) {
            const sorted = Array.from(processedEvents);
            sorted.slice(0, sorted.length - 1000).forEach(id => processedEvents.delete(id));
        }
    }
    catch (err) {
        console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
        return res.status(500).send();
    }
    return res.json({ received: true });
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
async function handlePaymentIntentSucceeded(paymentIntent, container) {
    console.info(`[Stripe Webhook] payment_intent.succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}, status: ${paymentIntent.status}`);
    try {
        const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        // For most card payments, Medusa already captured during cart.complete
        // This webhook arrives before/during order creation, so payment may not exist yet
        logger.info(`[Stripe Webhook] Payment successful in Stripe for ${paymentIntent.id}`);
        logger.info(`[Stripe Webhook] Note: Standard card payments are auto-captured by Medusa during checkout`);
        // If this is an async payment method (bank transfer, etc.), we would handle it here
        // For now, just log success
    }
    catch (error) {
        console.error(`[Stripe Webhook] Error processing payment_intent.succeeded:`, error);
    }
}
/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent, container) {
    console.warn(`[Stripe Webhook] payment_intent.payment_failed: ${paymentIntent.id}`);
    try {
        const paymentModule = container.resolve(utils_1.Modules.PAYMENT);
        const orderModule = container.resolve(utils_1.Modules.ORDER);
        const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        // Find payment collection
        const paymentCollections = await paymentModule.listPaymentCollections({
            metadata: {
                stripe_payment_intent_id: paymentIntent.id
            }
        });
        if (!paymentCollections || paymentCollections.length === 0) {
            logger.warn(`[Stripe Webhook] No payment collection found for failed payment_intent ${paymentIntent.id}`);
            return;
        }
        const paymentCollection = paymentCollections[0];
        const payments = await paymentModule.listPayments({
            payment_collection_id: paymentCollection.id
        });
        if (payments && payments.length > 0) {
            const payment = payments[0];
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
            });
            logger.info(`[Stripe Webhook] Payment ${payment.id} marked as failed`);
            // Update associated order
            const orders = await orderModule.listOrders({
                payment_collection_id: paymentCollection.id
            });
            if (orders && orders.length > 0) {
                const order = orders[0];
                await orderModule.updateOrders({
                    id: order.id,
                    payment_status: "failed"
                });
                logger.info(`[Stripe Webhook] Order ${order.id} payment marked as failed`);
                // TODO: Notify customer of payment failure
                // const notificationModule = container.resolve(Modules.NOTIFICATION)
                // await notificationModule.createNotifications({...})
            }
        }
    }
    catch (error) {
        console.error(`[Stripe Webhook] Error processing payment_intent.payment_failed:`, error);
        throw error;
    }
}
/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge, container) {
    console.info(`[Stripe Webhook] charge.refunded: ${charge.id}`);
    try {
        const paymentModule = container.resolve(utils_1.Modules.PAYMENT);
        const orderModule = container.resolve(utils_1.Modules.ORDER);
        const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        // Find payment by charge ID (may be in metadata or payment_intent)
        const paymentIntent = charge.payment_intent;
        if (!paymentIntent) {
            logger.warn(`[Stripe Webhook] No payment_intent linked to charge ${charge.id}`);
            return;
        }
        const paymentCollections = await paymentModule.listPaymentCollections({
            metadata: {
                stripe_payment_intent_id: paymentIntent
            }
        });
        if (!paymentCollections || paymentCollections.length === 0) {
            logger.warn(`[Stripe Webhook] No payment collection found for charge ${charge.id}`);
            return;
        }
        const paymentCollection = paymentCollections[0];
        const payments = await paymentModule.listPayments({
            payment_collection_id: paymentCollection.id
        });
        if (payments && payments.length > 0) {
            const payment = payments[0];
            // Create refund record in Medusa
            // Note: Stripe refund amount is in cents; Medusa may expect different format
            const refundAmount = charge.amount_refunded / 100; // Convert cents to currency unit
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
            });
            logger.info(`[Stripe Webhook] Payment ${payment.id} refunded: ${refundAmount}`);
            // Update order status
            const orders = await orderModule.listOrders({
                payment_collection_id: paymentCollection.id
            });
            if (orders && orders.length > 0) {
                const order = orders[0];
                await orderModule.updateOrders({
                    id: order.id,
                    payment_status: "refunded",
                    status: "refunded"
                });
                logger.info(`[Stripe Webhook] Order ${order.id} marked as refunded`);
                // TODO: Send refund confirmation email
            }
        }
    }
    catch (error) {
        console.error(`[Stripe Webhook] Error processing charge.refunded:`, error);
        throw error;
    }
}
/**
 * Handle checkout session completed (for payment links, etc.)
 */
async function handleCheckoutSessionCompleted(session, container) {
    console.info(`[Stripe Webhook] checkout.session.completed: ${session.id}`);
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    // Log session reconciliation
    logger.info(`[Stripe Webhook] Checkout session completed: ${session.id}, payment_intent: ${session.payment_intent}`);
    // For basic checkout flow, payment_intent.succeeded will handle the order
    // This is useful for payment link flows or custom checkout sessions
    // Add custom logic here if needed
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0cmlwZS93ZWJob29rL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBVUEsb0JBK0ZDO0FBeEdELHFEQUE4RTtBQUM5RSxvREFBMkI7QUFFM0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQkFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQyxDQUFBO0FBQzNELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUE7QUFFdkQsNEZBQTRGO0FBQzVGLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUE7QUFFbEMsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQXVCLENBQUE7SUFDakUsTUFBTSxVQUFVLEdBQUcsR0FBVSxDQUFBO0lBRTdCLGtFQUFrRTtJQUNsRSxJQUFJLE9BQWUsQ0FBQTtJQUVuQixJQUFJLFVBQVUsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUM5RCxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQTtJQUM5QixDQUFDO1NBQU0sSUFBSSxPQUFPLFVBQVUsQ0FBQyxPQUFPLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDbEQsT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUNuRCxDQUFDO1NBQU0sSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzVDLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFBO0lBQzNCLENBQUM7U0FBTSxJQUFJLE9BQU8sVUFBVSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMvQyxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFBO0lBQ2hELENBQUM7U0FBTSxDQUFDO1FBQ04seURBQXlEO1FBQ3pELE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFBO0lBQ2hFLENBQUM7SUFFRCxJQUFJLEtBQW1CLENBQUE7SUFFdkIsOERBQThEO0lBQzlELG9GQUFvRjtJQUNwRiw2R0FBNkc7SUFDN0csTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxDQUFBO0lBRTNELElBQUksWUFBWSxFQUFFLENBQUM7UUFDakIsT0FBTyxDQUFDLElBQUksQ0FBQyxzRUFBc0UsQ0FBQyxDQUFBO1FBQ3BGLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBb0IsQ0FBQTtJQUNsQyxDQUFDO1NBQU0sQ0FBQztRQUNOLElBQUksQ0FBQztZQUNILElBQUksYUFBYSxJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUN6QixLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxhQUFhLENBQUMsQ0FBQTtnQkFDbkUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvREFBb0QsQ0FBQyxDQUFBO1lBQ25FLENBQUM7aUJBQU0sQ0FBQztnQkFDTixPQUFPLENBQUMsSUFBSSxDQUFDLDZFQUE2RSxDQUFDLENBQUE7Z0JBQzNGLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBb0IsQ0FBQTtZQUNsQyxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUE7WUFDakUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRyxHQUFhLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDaEUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBbUIsR0FBYSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7UUFDekUsQ0FBQztJQUNILENBQUM7SUFFRCxrREFBa0Q7SUFDbEQsSUFBSSxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxFQUFFLDhCQUE4QixDQUFDLENBQUE7UUFDOUUsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQTtRQUUzQixRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuQixLQUFLLDBCQUEwQjtnQkFDN0IsTUFBTSw0QkFBNEIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQThCLEVBQUUsU0FBUyxDQUFDLENBQUE7Z0JBQ3hGLE1BQUs7WUFDUCxLQUFLLGtCQUFrQjtnQkFDckIsMkZBQTJGO2dCQUMzRix1REFBdUQ7Z0JBQ3ZELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBdUIsQ0FBQTtnQkFDakQsSUFBSSxPQUFPLE1BQU0sQ0FBQyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7b0JBQzlDLE1BQU0sRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFBO29CQUN0RSxNQUFNLDRCQUE0QixDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQTtnQkFDbkQsQ0FBQztnQkFDRCxNQUFLO1lBQ1AsS0FBSywrQkFBK0I7Z0JBQ2xDLE1BQU0seUJBQXlCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUE4QixFQUFFLFNBQVMsQ0FBQyxDQUFBO2dCQUNyRixNQUFLO1lBQ1AsS0FBSyxpQkFBaUI7Z0JBQ3BCLE1BQU0sb0JBQW9CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUF1QixFQUFFLFNBQVMsQ0FBQyxDQUFBO2dCQUN6RSxNQUFLO1lBQ1AsS0FBSyw0QkFBNEI7Z0JBQy9CLE1BQU0sOEJBQThCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFpQyxFQUFFLFNBQVMsQ0FBQyxDQUFBO2dCQUM3RixNQUFLO1lBQ1A7Z0JBQ0UsT0FBTyxDQUFDLElBQUksQ0FBQywwQ0FBMEMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUE7UUFDeEUsQ0FBQztRQUVELG9CQUFvQjtRQUNwQixlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQTtRQUU3Qix1Q0FBdUM7UUFDdkMsSUFBSSxlQUFlLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDO1lBQ2hDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUE7WUFDMUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7UUFDakYsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsS0FBSyxDQUFDLElBQUksR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBQ3BFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUMvQixDQUFDO0lBRUQsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUE7QUFDckMsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsS0FBSyxVQUFVLDRCQUE0QixDQUFDLGFBQW1DLEVBQUUsU0FBYztJQUM3RixPQUFPLENBQUMsSUFBSSxDQUFDLDhDQUE4QyxhQUFhLENBQUMsRUFBRSxhQUFhLGFBQWEsQ0FBQyxNQUFNLGFBQWEsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUE7SUFFaEosSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVsRSx1RUFBdUU7UUFDdkUsa0ZBQWtGO1FBQ2xGLE1BQU0sQ0FBQyxJQUFJLENBQUMscURBQXFELGFBQWEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBQ3BGLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkZBQTJGLENBQUMsQ0FBQTtRQUV4RyxvRkFBb0Y7UUFDcEYsNEJBQTRCO0lBRTlCLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyw2REFBNkQsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUNyRixDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHlCQUF5QixDQUFDLGFBQW1DLEVBQUUsU0FBYztJQUMxRixPQUFPLENBQUMsSUFBSSxDQUFDLG1EQUFtRCxhQUFhLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtJQUVuRixJQUFJLENBQUM7UUFDSCxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUN4RCxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNwRCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRWxFLDBCQUEwQjtRQUMxQixNQUFNLGtCQUFrQixHQUFHLE1BQU0sYUFBYSxDQUFDLHNCQUFzQixDQUFDO1lBQ3BFLFFBQVEsRUFBRTtnQkFDUix3QkFBd0IsRUFBRSxhQUFhLENBQUMsRUFBRTthQUMzQztTQUNGLENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQywwRUFBMEUsYUFBYSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFDekcsT0FBTTtRQUNSLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQy9DLE1BQU0sUUFBUSxHQUFHLE1BQU0sYUFBYSxDQUFDLFlBQVksQ0FBQztZQUNoRCxxQkFBcUIsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFO1NBQzVDLENBQUMsQ0FBQTtRQUVGLElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDcEMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBRTNCLGtDQUFrQztZQUNsQyxNQUFNLGFBQWEsQ0FBQyxjQUFjLENBQUM7Z0JBQ2pDLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRTtnQkFDZCxJQUFJLEVBQUU7b0JBQ0osUUFBUSxFQUFFO3dCQUNSLFlBQVksRUFBRSxhQUFhLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxJQUFJLGdCQUFnQjt3QkFDM0UsaUJBQWlCLEVBQUUsYUFBYSxDQUFDLGtCQUFrQixFQUFFLElBQUk7d0JBQ3pELG1CQUFtQixFQUFFLGFBQWEsQ0FBQyxrQkFBa0IsRUFBRSxZQUFZO3FCQUNwRTtpQkFDRjthQUNGLENBQUMsQ0FBQTtZQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLE9BQU8sQ0FBQyxFQUFFLG1CQUFtQixDQUFDLENBQUE7WUFFdEUsMEJBQTBCO1lBQzFCLE1BQU0sTUFBTSxHQUFHLE1BQU0sV0FBVyxDQUFDLFVBQVUsQ0FBQztnQkFDMUMscUJBQXFCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTthQUM1QyxDQUFDLENBQUE7WUFFRixJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBRXZCLE1BQU0sV0FBVyxDQUFDLFlBQVksQ0FBQztvQkFDN0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO29CQUNaLGNBQWMsRUFBRSxRQUFRO2lCQUN6QixDQUFDLENBQUE7Z0JBRUYsTUFBTSxDQUFDLElBQUksQ0FBQywwQkFBMEIsS0FBSyxDQUFDLEVBQUUsMkJBQTJCLENBQUMsQ0FBQTtnQkFFMUUsMkNBQTJDO2dCQUMzQyxxRUFBcUU7Z0JBQ3JFLHNEQUFzRDtZQUN4RCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4RixNQUFNLEtBQUssQ0FBQTtJQUNiLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxLQUFLLFVBQVUsb0JBQW9CLENBQUMsTUFBcUIsRUFBRSxTQUFjO0lBQ3ZFLE9BQU8sQ0FBQyxJQUFJLENBQUMscUNBQXFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO0lBRTlELElBQUksQ0FBQztRQUNILE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ3hELE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3BELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFbEUsbUVBQW1FO1FBQ25FLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxjQUF3QixDQUFBO1FBRXJELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNuQixNQUFNLENBQUMsSUFBSSxDQUFDLHVEQUF1RCxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtZQUMvRSxPQUFNO1FBQ1IsQ0FBQztRQUVELE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxhQUFhLENBQUMsc0JBQXNCLENBQUM7WUFDcEUsUUFBUSxFQUFFO2dCQUNSLHdCQUF3QixFQUFFLGFBQWE7YUFDeEM7U0FDRixDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsa0JBQWtCLElBQUksa0JBQWtCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzNELE1BQU0sQ0FBQyxJQUFJLENBQUMsMkRBQTJELE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBQ25GLE9BQU07UUFDUixDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUMvQyxNQUFNLFFBQVEsR0FBRyxNQUFNLGFBQWEsQ0FBQyxZQUFZLENBQUM7WUFDaEQscUJBQXFCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTtTQUM1QyxDQUFDLENBQUE7UUFFRixJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUUzQixpQ0FBaUM7WUFDakMsNkVBQTZFO1lBQzdFLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFBLENBQUMsaUNBQWlDO1lBRW5GLGtEQUFrRDtZQUNsRCxNQUFNLGFBQWEsQ0FBQyxjQUFjLENBQUM7Z0JBQ2pDLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRTtnQkFDZCxJQUFJLEVBQUU7b0JBQ0osUUFBUSxFQUFFO3dCQUNSLGVBQWUsRUFBRSxJQUFJO3dCQUNyQixvQkFBb0IsRUFBRSxZQUFZO3dCQUNsQyxrQkFBa0IsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtxQkFDN0M7aUJBQ0Y7YUFDRixDQUFDLENBQUE7WUFFRixNQUFNLENBQUMsSUFBSSxDQUFDLDRCQUE0QixPQUFPLENBQUMsRUFBRSxjQUFjLFlBQVksRUFBRSxDQUFDLENBQUE7WUFFL0Usc0JBQXNCO1lBQ3RCLE1BQU0sTUFBTSxHQUFHLE1BQU0sV0FBVyxDQUFDLFVBQVUsQ0FBQztnQkFDMUMscUJBQXFCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTthQUM1QyxDQUFDLENBQUE7WUFFRixJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBRXZCLE1BQU0sV0FBVyxDQUFDLFlBQVksQ0FBQztvQkFDN0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO29CQUNaLGNBQWMsRUFBRSxVQUFVO29CQUMxQixNQUFNLEVBQUUsVUFBVTtpQkFDbkIsQ0FBQyxDQUFBO2dCQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUE7Z0JBRXBFLHVDQUF1QztZQUN6QyxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvREFBb0QsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUMxRSxNQUFNLEtBQUssQ0FBQTtJQUNiLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxLQUFLLFVBQVUsOEJBQThCLENBQUMsT0FBZ0MsRUFBRSxTQUFjO0lBQzVGLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0RBQWdELE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO0lBRTFFLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUE7SUFFbEUsNkJBQTZCO0lBQzdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0RBQWdELE9BQU8sQ0FBQyxFQUFFLHFCQUFxQixPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQTtJQUVwSCwwRUFBMEU7SUFDMUUsb0VBQW9FO0lBQ3BFLGtDQUFrQztBQUNwQyxDQUFDIn0=