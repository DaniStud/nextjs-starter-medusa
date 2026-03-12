"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const stripe_1 = __importDefault(require("stripe"));
const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY || "");
// Idempotency tracker
const processedEvents = new Set();
async function handler(req, res, next) {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        if (stripeSecret && sig) {
            event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, stripeSecret);
        }
        else {
            // Fallback: parse body directly (insecure for production)
            console.warn("[Stripe Webhook] WARNING: No webhook secret configured, skipping signature verification");
            event = req.body;
        }
    }
    catch (err) {
        console.error("[Stripe Webhook] Signature verification failed:", err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Idempotency check
    if (processedEvents.has(event.id)) {
        console.info(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
        return res.json({ received: true, status: "duplicate" });
    }
    try {
        // Access Medusa container from request scope
        const container = req.scope;
        switch (event.type) {
            case "payment_intent.succeeded": {
                const pi = event.data.object;
                console.info(`[Stripe Webhook] payment_intent.succeeded: ${pi.id}`);
                // Business logic implementation (same as route.ts)
                // See src/api/stripe/webhook/route.ts for full implementation
                // This is a simplified version for reference
                console.log(`[Stripe Webhook] TODO: Implement payment capture logic for ${pi.id}`);
                break;
            }
            case "payment_intent.payment_failed": {
                const pi = event.data.object;
                console.warn(`[Stripe Webhook] payment_intent.payment_failed: ${pi.id}`);
                console.log(`[Stripe Webhook] Error: ${pi.last_payment_error?.message}`);
                break;
            }
            case "charge.refunded": {
                const charge = event.data.object;
                console.info(`[Stripe Webhook] charge.refunded: ${charge.id}`);
                console.log(`[Stripe Webhook] Refund amount: ${charge.amount_refunded / 100}`);
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object;
                console.info(`[Stripe Webhook] checkout.session.completed: ${session.id}`);
                break;
            }
            default:
                console.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
        // Mark as processed
        processedEvents.add(event.id);
        // Clean up old events
        if (processedEvents.size > 1000) {
            const sorted = Array.from(processedEvents);
            sorted.slice(0, sorted.length - 1000).forEach(id => processedEvents.delete(id));
        }
    }
    catch (err) {
        console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
        return res.status(500).send();
    }
    res.json({ received: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaXBlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2FwaS93ZWJob29rcy9zdHJpcGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFrQkEsMEJBMEVDO0FBbEZELG9EQUEyQjtBQUUzQixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFBO0FBQ3RELE1BQU0sTUFBTSxHQUFHLElBQUksZ0JBQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsQ0FBQTtBQUUzRCxzQkFBc0I7QUFDdEIsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQTtBQUUxQixLQUFLLFVBQVUsT0FBTyxDQUFDLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0I7SUFDbkYsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBdUIsQ0FBQTtJQUNqRSxJQUFJLEtBQW1CLENBQUE7SUFFdkIsSUFBSSxDQUFDO1FBQ0gsSUFBSSxZQUFZLElBQUksR0FBRyxFQUFFLENBQUM7WUFDeEIsS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFFLEdBQVcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsWUFBWSxDQUFDLENBQUE7UUFDN0YsQ0FBQzthQUFNLENBQUM7WUFDTiwwREFBMEQ7WUFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQyx5RkFBeUYsQ0FBQyxDQUFBO1lBQ3ZHLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBb0IsQ0FBQTtRQUNsQyxDQUFDO0lBQ0gsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLGlEQUFpRCxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBQ3JFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQW1CLEdBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFBO0lBQ3pFLENBQUM7SUFFRCxvQkFBb0I7SUFDcEIsSUFBSSxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxFQUFFLDhCQUE4QixDQUFDLENBQUE7UUFDOUUsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0gsNkNBQTZDO1FBQzdDLE1BQU0sU0FBUyxHQUFJLEdBQVcsQ0FBQyxLQUFLLENBQUE7UUFFcEMsUUFBUSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbkIsS0FBSywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBOEIsQ0FBQTtnQkFDcEQsT0FBTyxDQUFDLElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7Z0JBRW5FLG1EQUFtRDtnQkFDbkQsOERBQThEO2dCQUM5RCw2Q0FBNkM7Z0JBRTdDLE9BQU8sQ0FBQyxHQUFHLENBQUMsOERBQThELEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO2dCQUNsRixNQUFLO1lBQ1AsQ0FBQztZQUNELEtBQUssK0JBQStCLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQThCLENBQUE7Z0JBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsbURBQW1ELEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO2dCQUN4RSxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixFQUFFLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQTtnQkFDeEUsTUFBSztZQUNQLENBQUM7WUFDRCxLQUFLLGlCQUFpQixDQUFDLENBQUMsQ0FBQztnQkFDdkIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUF1QixDQUFBO2dCQUNqRCxPQUFPLENBQUMsSUFBSSxDQUFDLHFDQUFxQyxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQTtnQkFDOUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsTUFBTSxDQUFDLGVBQWUsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFBO2dCQUM5RSxNQUFLO1lBQ1AsQ0FBQztZQUNELEtBQUssNEJBQTRCLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQWlDLENBQUE7Z0JBQzVELE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0RBQWdELE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO2dCQUMxRSxNQUFLO1lBQ1AsQ0FBQztZQUNEO2dCQUNFLE9BQU8sQ0FBQyxJQUFJLENBQUMsMENBQTBDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFBO1FBQ3hFLENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUE7UUFFN0Isc0JBQXNCO1FBQ3RCLElBQUksZUFBZSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQztZQUNoQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFBO1lBQzFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO1FBQ2pGLENBQUM7SUFDSCxDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQTtRQUNwRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUE7SUFDL0IsQ0FBQztJQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQTtBQUM5QixDQUFDIn0=