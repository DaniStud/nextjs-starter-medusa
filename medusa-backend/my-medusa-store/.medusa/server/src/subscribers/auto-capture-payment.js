"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = autoCapturePaymentHandler;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Auto-capture Stripe payments when order is created
 *
 * This subscriber listens for order creation events and automatically
 * captures authorized payments, eliminating the need for manual capture.
 */
async function autoCapturePaymentHandler({ event, container }) {
    const logger = container.resolve("logger");
    const paymentModule = container.resolve(utils_1.Modules.PAYMENT);
    const { id: orderId } = event.data;
    try {
        logger.info(`[Auto-Capture] Order ${orderId} created, capturing authorized payments`);
        // List all payments - we'll filter to recent ones
        const allPayments = await paymentModule.listPayments({});
        // Get timestamp of 1 minute ago (only capture very recent payments)
        const oneMinuteAgo = new Date(Date.now() - 60000);
        let capturedCount = 0;
        for (const payment of allPayments) {
            // Skip if already captured
            if (payment.captured_at) {
                continue;
            }
            // Skip if not Stripe
            if (payment.provider_id !== 'pp_stripe_stripe') {
                continue;
            }
            // Only capture payments created in the last minute (related to current order)
            const paymentCreatedAt = new Date(payment.created_at);
            if (paymentCreatedAt < oneMinuteAgo) {
                continue;
            }
            try {
                logger.info(`[Auto-Capture] Capturing payment ${payment.id} (amount: ${payment.amount})`);
                await paymentModule.capturePayment({
                    payment_id: payment.id
                });
                capturedCount++;
                logger.info(`[Auto-Capture] ✅ Payment ${payment.id} captured successfully`);
            }
            catch (captureErr) {
                logger.error(`[Auto-Capture] ❌ Failed to capture payment ${payment.id}: ${captureErr.message}`);
            }
        }
        if (capturedCount > 0) {
            logger.info(`[Auto-Capture] ✅ Captured ${capturedCount} payment(s) for order ${orderId}`);
        }
        else {
            logger.info(`[Auto-Capture] No recent uncaptured Stripe payments found for order ${orderId}`);
        }
    }
    catch (error) {
        logger.error(`[Auto-Capture] Error in auto-capture handler: ${error.message}`);
    }
}
exports.config = {
    event: "order.placed",
    context: {
        subscriberId: "auto-capture-payment-handler",
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0by1jYXB0dXJlLXBheW1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc3Vic2NyaWJlcnMvYXV0by1jYXB0dXJlLXBheW1lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBU0EsNENBd0RDO0FBaEVELHFEQUFtRDtBQUVuRDs7Ozs7R0FLRztBQUNZLEtBQUssVUFBVSx5QkFBeUIsQ0FBQyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQU87SUFDL0UsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUMxQyxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUV4RCxNQUFNLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUE7SUFFbEMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsT0FBTyx5Q0FBeUMsQ0FBQyxDQUFBO1FBRXJGLGtEQUFrRDtRQUNsRCxNQUFNLFdBQVcsR0FBRyxNQUFNLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUE7UUFFeEQsb0VBQW9FO1FBQ3BFLE1BQU0sWUFBWSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQTtRQUVqRCxJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUE7UUFFckIsS0FBSyxNQUFNLE9BQU8sSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNsQywyQkFBMkI7WUFDM0IsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ3hCLFNBQVE7WUFDVixDQUFDO1lBRUQscUJBQXFCO1lBQ3JCLElBQUksT0FBTyxDQUFDLFdBQVcsS0FBSyxrQkFBa0IsRUFBRSxDQUFDO2dCQUMvQyxTQUFRO1lBQ1YsQ0FBQztZQUVELDhFQUE4RTtZQUM5RSxNQUFNLGdCQUFnQixHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQTtZQUNyRCxJQUFJLGdCQUFnQixHQUFHLFlBQVksRUFBRSxDQUFDO2dCQUNwQyxTQUFRO1lBQ1YsQ0FBQztZQUVELElBQUksQ0FBQztnQkFDSCxNQUFNLENBQUMsSUFBSSxDQUFDLG9DQUFvQyxPQUFPLENBQUMsRUFBRSxhQUFhLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO2dCQUV6RixNQUFNLGFBQWEsQ0FBQyxjQUFjLENBQUM7b0JBQ2pDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtpQkFDdkIsQ0FBQyxDQUFBO2dCQUVGLGFBQWEsRUFBRSxDQUFBO2dCQUNmLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLE9BQU8sQ0FBQyxFQUFFLHdCQUF3QixDQUFDLENBQUE7WUFDN0UsQ0FBQztZQUFDLE9BQU8sVUFBZSxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sQ0FBQyxLQUFLLENBQUMsOENBQThDLE9BQU8sQ0FBQyxFQUFFLEtBQUssVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7WUFDakcsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLGFBQWEsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLDZCQUE2QixhQUFhLHlCQUF5QixPQUFPLEVBQUUsQ0FBQyxDQUFBO1FBQzNGLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxDQUFDLElBQUksQ0FBQyx1RUFBdUUsT0FBTyxFQUFFLENBQUMsQ0FBQTtRQUMvRixDQUFDO0lBQ0gsQ0FBQztJQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7UUFDcEIsTUFBTSxDQUFDLEtBQUssQ0FBQyxpREFBaUQsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7SUFDaEYsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUI7SUFDdEMsS0FBSyxFQUFFLGNBQWM7SUFDckIsT0FBTyxFQUFFO1FBQ1AsWUFBWSxFQUFFLDhCQUE4QjtLQUM3QztDQUNGLENBQUEifQ==