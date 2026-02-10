# Stripe Webhook Implementation Guide

## Overview

The Stripe webhook integration handles payment events from Stripe and synchronizes them with Medusa orders and payments. This document explains how the webhook system works, how to test it, and what to watch for in production.

## Architecture

### Webhook Endpoint
- **URL**: `POST /stripe/webhook`
- **Location**: `src/api/stripe/webhook/route.ts`
- **Alternative**: `src/api/webhooks/stripe.ts` (Express-style handler)

### Event Flow
```
1. Customer pays → Stripe processes payment
2. Stripe sends webhook → Your endpoint receives event
3. Signature verified → Event authenticated
4. Idempotency check → Prevent duplicate processing
5. Business logic → Update Medusa payment/order
6. Response sent → Stripe marks webhook as delivered
```

## Supported Events

### 1. `payment_intent.succeeded`
**Triggered when**: Payment is successfully captured by Stripe

**Actions**:
- Finds payment collection by Stripe payment intent ID
- Captures payment in Medusa
- Updates order status to "completed"
- Updates payment status to "captured"
- (TODO) Triggers order confirmation email

**Query**: Looks for payment collection with metadata:
```json
{
  "stripe_payment_intent_id": "pi_xxxxx"
}
```

### 2. `payment_intent.payment_failed`
**Triggered when**: Payment fails (declined card, authentication failure, etc.)

**Actions**:
- Finds payment collection by Stripe payment intent ID
- Updates payment metadata with error details
- Updates order payment status to "failed"
- Logs error reason from Stripe
- (TODO) Notifies customer of payment failure

**Error Details Captured**:
- Error message
- Error code
- Decline code (card declined reason)

### 3. `charge.refunded`
**Triggered when**: A charge is refunded (full or partial)

**Actions**:
- Finds payment by associated payment intent
- Updates payment metadata with refund details
- Updates order payment status to "refunded"
- Updates order status to "refunded"
- (TODO) Sends refund confirmation email

**Refund Amount**: Converted from cents to currency unit

### 4. `checkout.session.completed`
**Triggered when**: Stripe Checkout session completes

**Actions**:
- Logs session reconciliation
- Useful for payment link flows
- Primary checkout flow is handled by `payment_intent.succeeded`

## Implementation Details

### Idempotency
The webhook uses an in-memory `Set` to track processed event IDs:
- Prevents duplicate processing if Stripe retries webhook delivery
- Keeps last 1000 events in memory
- For production multi-instance deployments, consider using Redis

**Production Recommendation**: Replace in-memory Set with Redis:
```typescript
// Example with Redis
const redis = new Redis()
const eventKey = `stripe_event:${event.id}`
const isProcessed = await redis.get(eventKey)
if (isProcessed) return
await redis.setex(eventKey, 86400, "1") // 24 hour TTL
```

### Signature Verification
All webhooks verify Stripe signatures using `stripe.webhooks.constructEvent()`:
- Requires raw request body (configured in `medusa-config.ts`)
- Uses `STRIPE_WEBHOOK_SECRET` from environment
- Rejects webhooks with invalid signatures (returns 400)

### Error Handling
- All webhook handlers wrapped in try-catch
- Errors logged with full context
- Returns 500 on processing errors (Stripe will retry)
- Gracefully handles missing orders/payments

### Service Resolution
Accesses Medusa services via dependency injection:
```typescript
const container = req.scope
const paymentModule = container.resolve(Modules.PAYMENT)
const orderModule = container.resolve(Modules.ORDER)
const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
```

## Testing

### Local Testing with Stripe CLI

1. **Start Medusa backend**:
```bash
cd medusa-backend/my-medusa-store
npm run dev
```

2. **Start Stripe webhook forwarding**:
```bash
stripe listen --forward-to http://localhost:9000/stripe/webhook
```

3. **Trigger test events**:
```bash
# Payment succeeded
stripe trigger payment_intent.succeeded

# Payment failed
stripe trigger payment_intent.payment_failed

# Charge refunded
stripe trigger charge.refunded
```

4. **Check logs**: Watch Medusa backend logs for webhook processing

### Test Scenarios

#### Success Flow
1. Open storefront → add product → checkout
2. Enter test card: `4242 4242 4242 4242`, expiry `12/34`, CVC `123`
3. Complete payment
4. Verify logs show `payment_intent.succeeded` received
5. Check order marked as "paid" in Medusa Admin

#### Declined Card
1. Use test card: `4000 0000 0000 0002`
2. Attempt payment
3. Verify `payment_intent.payment_failed` event received
4. Check error details logged
5. Verify payment status updated to "failed"

#### 3D Secure / SCA
1. Use test card: `4000 0025 0000 3155`
2. Complete 3D Secure authentication
3. Verify payment succeeds after authentication
4. Check webhook received and processed

#### Refund Flow
1. Complete successful order
2. From Medusa Admin → issue refund
3. Or from Stripe Dashboard → refund charge
4. Verify `charge.refunded` event received
5. Check order marked as "refunded"

### Edge Cases to Test

1. **Webhook arrives before order created**:
   - Payment may be processed before order is saved
   - Handler should log warning and skip (not crash)
   - Later retry may succeed

2. **Duplicate webhook delivery**:
   - Stripe may retry webhooks
   - Idempotency check should catch duplicates
   - Response should be `{received: true, status: "duplicate"}`

3. **Timeout during processing**:
   - Webhook handler has limited time to respond
   - If processing takes >30s, Stripe will retry
   - Ensure idempotency handles this

## Production Configuration

### Stripe Dashboard Setup
1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://yourdomain.com/stripe/webhook`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `checkout.session.completed`
5. Copy **Signing secret** → save to `.env.production`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### Environment Variables
Required in production:
```
STRIPE_API_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Security Checklist
- ✅ Signature verification enabled
- ✅ HTTPS endpoint (required by Stripe)
- ✅ Webhook secret stored securely
- ✅ Raw body parsing configured
- ✅ Idempotency implemented
- ✅ Error logging enabled
- ✅ No sensitive data logged

### Monitoring
Monitor these metrics in production:
- **Webhook delivery time**: Should be <5s
- **Error rate**: Should be <1%
- **Retry rate**: High retries indicate processing issues
- **Failed signatures**: Potential security issue

Check Stripe Dashboard → Developers → Webhooks for:
- Delivery status
- Response codes
- Retry attempts
- Failed deliveries

## Troubleshooting

### Webhook not received
- Check endpoint is publicly accessible (HTTPS)
- Verify webhook endpoint URL in Stripe Dashboard
- Check firewall/security group settings
- Verify Medusa server is running

### Signature verification fails
- Ensure `STRIPE_WEBHOOK_SECRET` is correct
- Check raw body is available (`rawBodyPaths` in `medusa-config.ts`)
- Verify no body parsing middleware interferes

### Payment not captured in Medusa
- Check payment collection has `stripe_payment_intent_id` in metadata
- Verify payment intent ID matches webhook event
- Check Medusa logs for errors
- Ensure payment module is properly configured

### Duplicate processing
- Idempotency should prevent this
- If using multiple instances, implement Redis-based tracking
- Check event IDs are unique

### Order not found
- Normal if webhook arrives before order is created
- Handler logs warning and skips
- Stripe will retry, subsequent attempt may succeed

## Future Improvements

### Recommended Enhancements
1. **Redis-based idempotency** (for multi-instance deployments)
2. **Email notifications** (order confirmation, payment failure, refund)
3. **Webhook event logging** (database audit trail)
4. **Retry logic with exponential backoff**
5. **Monitoring/alerting integration** (Sentry, DataDog, etc.)
6. **Admin UI for webhook status** (view recent events, retry failed)

### TODOs in Code
Search for `TODO` comments in webhook handler for specific improvements:
- Order confirmation email trigger
- Payment failure customer notification
- Refund confirmation email
- Proper refund workflow integration

## API Reference

### Webhook Response Format
```json
{
  "received": true,
  "status": "duplicate" // Optional, only for duplicate events
}
```

### Error Response
```json
{
  "error": "Webhook Error: <message>"
}
```

### HTTP Status Codes
- `200`: Event processed successfully
- `400`: Signature verification failed
- `500`: Internal processing error (Stripe will retry)

## Related Files
- `src/api/stripe/webhook/route.ts` - Main webhook handler
- `src/api/webhooks/stripe.ts` - Alternative Express handler
- `src/api/stripe/utils.ts` - Stripe utility functions
- `medusa-config.ts` - Stripe module configuration
- `.env` - Environment variables (local)
- `.env.production` - Production environment variables

## Support
For issues or questions:
1. Check Medusa logs: `npm run dev` output
2. Check Stripe Dashboard → Developers → Webhooks → Events
3. Review error logs in application monitoring
4. Consult Stripe API documentation: https://stripe.com/docs/webhooks
5. Consult Medusa documentation: https://docs.medusajs.com
