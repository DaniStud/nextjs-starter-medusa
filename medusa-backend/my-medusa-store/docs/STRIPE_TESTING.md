# Stripe Webhook Testing Guide

## Quick Start Testing

### Prerequisites
- Medusa backend running on `http://localhost:9000`
- Stripe CLI installed (`stripe` command available)
- Test API keys configured in `.env`

### Run Tests in 5 Minutes

```bash
# Terminal 1: Start Medusa backend
cd medusa-backend/my-medusa-store
npm run dev

# Terminal 2: Start Stripe webhook forwarding
stripe listen --forward-to http://localhost:9000/stripe/webhook

# Terminal 3: Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

## Test Scenarios

### 1. Successful Payment Flow

**Objective**: Verify complete payment flow from checkout to order confirmation

**Steps**:
1. Open storefront: `http://localhost:8000`
2. Add product to cart
3. Proceed to checkout
4. Enter test card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Postal code: `12345`
5. Complete payment

**Expected Results**:
- ✅ Payment succeeds on frontend
- ✅ Webhook received: `payment_intent.succeeded`
- ✅ Backend logs show: `[Stripe Webhook] payment_intent.succeeded: pi_xxxxx`
- ✅ Payment collection found
- ✅ Payment captured in Medusa
- ✅ Order status updated to "completed"
- ✅ Payment status updated to "captured"
- ✅ Webhook responds with `{received: true}`

**Check Logs**:
```
[Stripe Webhook] payment_intent.succeeded: pi_xxxxx
[Stripe Webhook] Found payment collection: paycol_xxxxx
[Stripe Webhook] Payment pay_xxxxx captured successfully
[Stripe Webhook] Order order_xxxxx marked as paid
```

---

### 2. Declined Card

**Objective**: Verify payment failure handling

**Steps**:
1. Follow steps 1-3 from Successful Payment Flow
2. Enter **declined card**: `4000 0000 0000 0002`
   - Expiry: `12/34`
   - CVC: `123`
3. Attempt payment

**Expected Results**:
- ✅ Payment fails on frontend with error message
- ✅ Webhook received: `payment_intent.payment_failed`
- ✅ Backend logs show: `[Stripe Webhook] payment_intent.payment_failed: pi_xxxxx`
- ✅ Payment metadata updated with error details
- ✅ Order payment status updated to "failed"
- ✅ Error reason logged

**Check Logs**:
```
[Stripe Webhook] payment_intent.payment_failed: pi_xxxxx
[Stripe Webhook] Payment pay_xxxxx marked as failed
[Stripe Webhook] Order order_xxxxx payment marked as failed
```

**Test Cards for Different Decline Reasons**:
| Card Number | Decline Code | Description |
|-------------|--------------|-------------|
| `4000 0000 0000 0002` | `card_declined` | Generic decline |
| `4000 0000 0000 9995` | `insufficient_funds` | Insufficient funds |
| `4000 0000 0000 9987` | `lost_card` | Lost card |
| `4000 0000 0000 9979` | `stolen_card` | Stolen card |

---

### 3. 3D Secure / SCA Flow

**Objective**: Verify Strong Customer Authentication (required for EU)

**Steps**:
1. Follow steps 1-3 from Successful Payment Flow
2. Enter **SCA card**: `4000 0025 0000 3155`
   - Expiry: `12/34`
   - CVC: `123`
3. Wait for 3D Secure modal to appear
4. Click **Complete** in test authentication modal

**Expected Results**:
- ✅ 3D Secure modal appears
- ✅ Authentication completes successfully
- ✅ Payment succeeds after authentication
- ✅ Webhook received: `payment_intent.succeeded`
- ✅ Order marked as paid

**SCA Test Cards**:
| Card Number | Behavior |
|-------------|----------|
| `4000 0025 0000 3155` | Requires authentication |
| `4000 0000 0000 3220` | Authentication already performed |
| `4000 0082 6000 0000` | Authentication fails |

---

### 4. Refund Flow

**Objective**: Verify refund processing

**Prerequisites**: Completed successful payment (Test 1)

**Steps**:
1. Open Medusa Admin: `http://localhost:9000/app`
2. Navigate to Orders → Find the test order
3. Click "Refund" or use Stripe Dashboard
4. Issue full or partial refund

**Expected Results**:
- ✅ Refund processed in Stripe
- ✅ Webhook received: `charge.refunded`
- ✅ Backend logs show: `[Stripe Webhook] charge.refunded: ch_xxxxx`
- ✅ Payment metadata updated with refund details
- ✅ Order payment status updated to "refunded"
- ✅ Order status updated to "refunded"

**Check Logs**:
```
[Stripe Webhook] charge.refunded: ch_xxxxx
[Stripe Webhook] Payment pay_xxxxx refunded: 25.00
[Stripe Webhook] Order order_xxxxx marked as refunded
```

---

### 5. Idempotency Test

**Objective**: Verify duplicate webhook rejection

**Steps**:
1. Trigger a test webhook:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
2. Note the event ID from logs (e.g., `evt_xxxxx`)
3. Use Stripe CLI to retry the same event:
   ```bash
   # Stripe automatically retries on failure
   # Or manually replay from Dashboard: Developers → Webhooks → Event → Resend
   ```

**Expected Results**:
- ✅ First webhook processed successfully
- ✅ Duplicate webhook detected
- ✅ Response includes: `{received: true, status: "duplicate"}`
- ✅ No double-processing of payment

**Check Logs**:
```
[Stripe Webhook] Event evt_xxxxx already processed, skipping
```

---

### 6. Signature Verification Test

**Objective**: Verify webhook security

**Steps**:
1. Send malformed webhook (wrong signature):
   ```bash
   curl -X POST http://localhost:9000/stripe/webhook \
     -H "Content-Type: application/json" \
     -H "stripe-signature: invalid_signature" \
     -d '{"type":"payment_intent.succeeded"}'
   ```

**Expected Results**:
- ✅ Webhook rejected with HTTP 400
- ✅ Error logged: `Signature verification failed`
- ✅ No payment processing occurs

**Check Logs**:
```
[Stripe Webhook] Signature verification failed: Error: ...
```

---

### 7. Missing Order Edge Case

**Objective**: Verify graceful handling when order doesn't exist yet

**Setup**:
This is difficult to test manually since webhooks are usually fast. To simulate:

**Steps**:
1. Trigger webhook before order is created:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
2. Webhook will look for payment collection but won't find it

**Expected Results**:
- ✅ Webhook doesn't crash
- ✅ Warning logged: `No payment collection found for payment_intent pi_xxxxx`
- ✅ Webhook responds with HTTP 200 (Stripe won't retry)
- ✅ System remains stable

**Check Logs**:
```
[Stripe Webhook] No payment collection found for payment_intent pi_xxxxx
```

---

### 8. Timeout / Retry Test

**Objective**: Verify webhook timeout handling

**Steps**:
1. Add artificial delay to webhook handler (for testing only):
   ```typescript
   // In route.ts, add this to POST handler:
   await new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds
   ```
2. Trigger webhook
3. Stripe will timeout after 30s and retry

**Expected Results**:
- ✅ First attempt times out
- ✅ Stripe retries webhook
- ✅ Idempotency prevents double-processing
- ✅ Second attempt succeeds (if delay removed)

**Production Note**: Remove delay after testing!

---

## Automated Testing

### Unit Tests (TODO)

Create `src/api/stripe/webhook/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals"
import { POST } from "./route"

describe("Stripe Webhook Handler", () => {
  it("should reject invalid signatures", async () => {
    // Test signature verification
  })

  it("should handle payment_intent.succeeded", async () => {
    // Test successful payment
  })

  it("should handle payment_intent.payment_failed", async () => {
    // Test failed payment
  })

  it("should prevent duplicate processing", async () => {
    // Test idempotency
  })
})
```

### Integration Tests (TODO)

Create end-to-end test suite:
1. Create test order
2. Trigger webhook
3. Verify order updated
4. Clean up test data

---

## Manual Testing Checklist

Before deploying to production:

- [ ] Successful payment flow works end-to-end
- [ ] Declined card handled gracefully
- [ ] 3D Secure authentication works (if applicable)
- [ ] Refund processed correctly
- [ ] Duplicate webhooks rejected (idempotency)
- [ ] Invalid signatures rejected (security)
- [ ] Missing order handled gracefully
- [ ] All test cards work as expected
- [ ] Logs show detailed payment information
- [ ] No sensitive data logged (card numbers, CVCs)
- [ ] Webhook responds within 30 seconds
- [ ] Error handling works for all scenarios

---

## Debugging Guide

### Webhook Not Received

**Check**:
1. Medusa backend running: `ps aux | grep node`
2. Port 9000 accessible: `curl http://localhost:9000/health`
3. Stripe CLI forwarding: `stripe listen` output shows "Ready!"
4. Webhook URL correct in Stripe Dashboard

**Fix**:
```bash
# Restart Stripe forwarding
stripe listen --forward-to http://localhost:9000/stripe/webhook

# Check Medusa logs
tail -f medusa-backend/my-medusa-store/logs/medusa.log
```

### Payment Not Captured

**Check**:
1. Payment collection exists in database
2. Payment collection has `stripe_payment_intent_id` in metadata
3. Payment intent ID matches webhook event
4. Medusa logs show error details

**Debug**:
```bash
# Check database for payment collection
# (adjust based on your database)
psql -U medusa -d medusa -c "SELECT * FROM payment_collection WHERE metadata->>'stripe_payment_intent_id' = 'pi_xxxxx';"
```

### Signature Verification Fails

**Check**:
1. `STRIPE_WEBHOOK_SECRET` set correctly in `.env`
2. Raw body available (check `rawBodyPaths` in `medusa-config.ts`)
3. Webhook secret matches Stripe Dashboard
4. No body parsing middleware interfering

**Fix**:
```bash
# Get new webhook secret
stripe listen --forward-to http://localhost:9000/stripe/webhook
# Copy whsec_xxxxx to .env

# Restart Medusa backend
npm run dev
```

### Order Not Found

This is **normal** if webhook arrives before order is created.

**Expected Behavior**:
- Warning logged
- Webhook returns 200 (success)
- Stripe may retry
- Subsequent retry may succeed

**Not a Bug**: Webhooks can arrive milliseconds before order is saved.

---

## Test Card Reference

### Success Cards
| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Standard success |
| `5555 5555 5555 4444` | Mastercard success |
| `3782 822463 10005` | American Express success |

### Failure Cards
| Card Number | Error |
|-------------|-------|
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |

### SCA/3D Secure Cards
| Card Number | Behavior |
|-------------|----------|
| `4000 0025 0000 3155` | Requires authentication (success) |
| `4000 0082 6000 0000` | Authentication fails |

Full list: https://stripe.com/docs/testing#cards

---

## Production Testing

Before going live:

1. **Switch to live keys**:
   ```
   STRIPE_API_KEY=sk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx (from Stripe Dashboard)
   ```

2. **Configure webhook in Stripe Dashboard**:
   - URL: `https://yourdomain.com/stripe/webhook`
   - Events: `payment_intent.*`, `charge.refunded`

3. **Test with small amount**:
   - Make real $1 purchase
   - Verify webhook received
   - Check order created correctly
   - Refund the test payment

4. **Monitor for 24 hours**:
   - Check webhook delivery rate
   - Monitor error logs
   - Verify all payments processed

---

## Troubleshooting Commands

```bash
# Check Medusa is running
curl http://localhost:9000/health

# Check webhook endpoint
curl http://localhost:9000/stripe/webhook
# Should return: 404 or "Method not allowed" (GET not supported)

# Trigger test webhook
stripe trigger payment_intent.succeeded

# View recent Stripe events
stripe events list

# Resend specific event
stripe events resend evt_xxxxx

# Check Stripe logs
stripe listen --print-json

# View webhook delivery attempts (Dashboard)
# Developers → Webhooks → Click endpoint → View attempts
```

---

## Next Steps

After completing testing:

1. ✅ All test scenarios pass
2. ✅ Edge cases handled
3. ✅ Production webhook configured
4. ✅ Monitoring enabled
5. → Proceed to Step 5: Production deployment
6. → Document in team wiki
7. → Set up alerting for webhook failures

