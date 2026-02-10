# Stripe Payment Testing Checklist

**Date**: February 10, 2026  
**Step**: 5 - Test Payment Scenarios  
**Status**: In Progress

## Pre-Testing Setup

### Environment Check
- [ ] Docker Desktop running
- [ ] Postgres and Redis containers running (`docker compose up -d`)
- [ ] Medusa backend running (`npm run dev` on port 9000)
- [ ] Storefront running (`npm run dev` on port 8000)
- [ ] Stripe CLI installed and logged in
- [ ] Webhook forwarding active (`stripe listen --forward-to http://localhost:9000/stripe/webhook`)

### Quick Verification
```bash
# Check backend health
curl http://localhost:9000/health

# Check storefront
curl http://localhost:8000

# Verify Stripe CLI
stripe --version
```

---

## Test Scenario 1: Basic Success Flow ✅ / ❌

**Objective**: Verify complete payment flow from checkout to order confirmation

### Steps
1. [ ] Open storefront: http://localhost:8000
2. [ ] Browse products and add item to cart
3. [ ] Proceed to checkout
4. [ ] Enter test card details:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Postal: `12345`
5. [ ] Complete payment
6. [ ] Check payment success message on frontend

### Verification
- [ ] Payment succeeds on frontend
- [ ] Backend logs show: `[Stripe Webhook] payment_intent.succeeded: pi_xxxxx`
- [ ] Backend logs show: `[Stripe Webhook] Found payment collection: paycol_xxxxx`
- [ ] Backend logs show: `[Stripe Webhook] Payment captured successfully`
- [ ] Backend logs show: `[Stripe Webhook] Order order_xxxxx marked as paid`
- [ ] Stripe Dashboard shows successful payment
- [ ] Medusa Admin shows order with status "completed"
- [ ] Medusa Admin shows payment status "captured"

### Results
**Status**: ⏳ Not Started / ✅ Pass / ❌ Fail  
**Notes**:
```
[Record any observations, errors, or issues here]
```

---

## Test Scenario 2: Declined Card ✅ / ❌

**Objective**: Verify payment failure handling

### Steps
1. [ ] Open storefront: http://localhost:8000
2. [ ] Add product to cart
3. [ ] Proceed to checkout
4. [ ] Enter **declined card**:
   - Card: `4000 0000 0000 0002`
   - Expiry: `12/34`
   - CVC: `123`
5. [ ] Attempt payment

### Verification
- [ ] Payment fails on frontend with error message
- [ ] Backend logs show: `[Stripe Webhook] payment_intent.payment_failed: pi_xxxxx`
- [ ] Backend logs show error details (decline reason)
- [ ] Backend logs show: `[Stripe Webhook] Payment marked as failed`
- [ ] Medusa Admin shows payment status "failed"
- [ ] Error message is user-friendly (no technical jargon)

### Additional Decline Tests
Test different decline reasons:

- [ ] **Insufficient funds**: `4000 0000 0000 9995`
- [ ] **Lost card**: `4000 0000 0000 9987`
- [ ] **Stolen card**: `4000 0000 0000 9979`
- [ ] **Expired card**: `4000 0000 0000 0069`
- [ ] **Incorrect CVC**: `4000 0000 0000 0127`

### Results
**Status**: ⏳ Not Started / ✅ Pass / ❌ Fail  
**Notes**:
```
[Record any observations, errors, or issues here]
```

---

## Test Scenario 3: 3D Secure (SCA) Flow ✅ / ❌

**Objective**: Verify Strong Customer Authentication for EU compliance

### Steps
1. [ ] Open storefront: http://localhost:8000
2. [ ] Add product to cart
3. [ ] Proceed to checkout
4. [ ] Enter **3D Secure card**:
   - Card: `4000 0025 0000 3155`
   - Expiry: `12/34`
   - CVC: `123`
5. [ ] Wait for 3D Secure authentication modal
6. [ ] Click **Complete** in test authentication modal
7. [ ] Verify payment completes

### Verification
- [ ] 3D Secure authentication modal appears
- [ ] Authentication completes successfully
- [ ] Payment succeeds after authentication
- [ ] Backend logs show: `[Stripe Webhook] payment_intent.succeeded: pi_xxxxx`
- [ ] Order marked as paid
- [ ] Payment flow is smooth (no errors or timeouts)

### Additional SCA Tests
- [ ] **Authentication already done**: `4000 0000 0000 3220`
- [ ] **Authentication fails**: `4000 0082 6000 0000` (should fail gracefully)

### Results
**Status**: ⏳ Not Started / ✅ Pass / ❌ Fail  
**Notes**:
```
[Record any observations, errors, or issues here]
```

---

## Test Scenario 4: Stripe CLI Triggers ✅ / ❌

**Objective**: Verify webhook handler processes events correctly (offline testing)

### Setup
Ensure Stripe CLI is forwarding webhooks:
```bash
stripe listen --forward-to http://localhost:9000/stripe/webhook
```

### Test 4.1: Payment Intent Succeeded
```bash
stripe trigger payment_intent.succeeded
```

**Verification**:
- [ ] Webhook received by backend
- [ ] Backend logs show event processing
- [ ] Handler executes without errors
- [ ] Response: `{received: true}`

**Expected Logs**:
```
[Stripe Webhook] payment_intent.succeeded: pi_xxxxx
[Stripe Webhook] No payment collection found for payment_intent pi_xxxxx
```
*Note: This is expected since no real order exists*

### Test 4.2: Payment Intent Failed
```bash
stripe trigger payment_intent.payment_failed
```

**Verification**:
- [ ] Webhook received
- [ ] Error details logged
- [ ] Handler completes without crash

### Test 4.3: Charge Refunded
```bash
stripe trigger charge.refunded
```

**Verification**:
- [ ] Webhook received
- [ ] Refund processing logged
- [ ] Handler completes successfully

### Test 4.4: Checkout Session Completed
```bash
stripe trigger checkout.session.completed
```

**Verification**:
- [ ] Webhook received
- [ ] Session logged
- [ ] Handler completes successfully

### Results
**Status**: ⏳ Not Started / ✅ Pass / ❌ Fail  
**Notes**:
```
[Record CLI trigger results here]
```

---

## Test Scenario 5: Refund Flow ✅ / ❌

**Objective**: Verify refund processing works correctly

### Prerequisites
- [ ] Complete a successful payment first (Test Scenario 1)
- [ ] Note the order ID

### Steps - Option 1: Via Medusa Admin
1. [ ] Open Medusa Admin: http://localhost:9000/app
2. [ ] Navigate to Orders
3. [ ] Find the test order
4. [ ] Click "Refund" or "Issue Refund"
5. [ ] Complete refund process

### Steps - Option 2: Via Stripe Dashboard
1. [ ] Open Stripe Dashboard: https://dashboard.stripe.com/test/payments
2. [ ] Find the payment
3. [ ] Click "Refund"
4. [ ] Enter amount and confirm

### Verification
- [ ] Refund processes in Stripe
- [ ] Backend logs show: `[Stripe Webhook] charge.refunded: ch_xxxxx`
- [ ] Backend logs show: `[Stripe Webhook] Payment refunded: XX.XX`
- [ ] Backend logs show: `[Stripe Webhook] Order marked as refunded`
- [ ] Medusa Admin shows payment status "refunded"
- [ ] Medusa Admin shows order status "refunded"
- [ ] Refund amount is correct (matches original payment)

### Results
**Status**: ⏳ Not Started / ✅ Pass / ❌ Fail  
**Refund Amount**: $______  
**Notes**:
```
[Record refund processing details]
```

---

## Test Scenario 6: Edge Cases ✅ / ❌

### Edge Case 6.1: Duplicate Webhook Delivery

**Objective**: Verify idempotency prevents double-processing

**Steps**:
1. [ ] Trigger a webhook: `stripe trigger payment_intent.succeeded`
2. [ ] Note the event ID from logs
3. [ ] From Stripe Dashboard → Webhooks → Find event → Click "Resend"
4. [ ] Check backend logs

**Verification**:
- [ ] First webhook processed successfully
- [ ] Second webhook detected as duplicate
- [ ] Logs show: `Event evt_xxxxx already processed, skipping`
- [ ] Response includes: `{received: true, status: "duplicate"}`
- [ ] No double-processing occurs

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```

```

### Edge Case 6.2: Invalid Signature

**Objective**: Verify security (reject invalid webhooks)

**Steps**:
```bash
curl -X POST http://localhost:9000/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid_signature_here" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{}}}'
```

**Verification**:
- [ ] Request rejected with HTTP 400
- [ ] Logs show: `Signature verification failed`
- [ ] No payment processing occurs
- [ ] System remains secure

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```

```

### Edge Case 6.3: Webhook Before Order Created

**Objective**: Verify graceful handling of race conditions

**Note**: This is difficult to test manually, but handler should:
- [ ] Log warning: `No payment collection found`
- [ ] Return HTTP 200 (not crash)
- [ ] Allow Stripe to retry
- [ ] Subsequent retry may succeed

**Verification**:
- [ ] Handler doesn't crash when payment collection missing
- [ ] Warning logged (not error)
- [ ] System remains stable
- [ ] Reviewed code logic for correctness

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```

```

### Edge Case 6.4: Missing Environment Variables

**Objective**: Verify graceful failure with helpful error messages

**Steps** (DO IN DEVELOPMENT ONLY):
1. [ ] Temporarily rename `STRIPE_WEBHOOK_SECRET` in `.env`
2. [ ] Restart backend
3. [ ] Trigger webhook
4. [ ] Check error message
5. [ ] **RESTORE** environment variable

**Verification**:
- [ ] Clear error message about missing secret
- [ ] No crash or unexpected behavior
- [ ] Helpful troubleshooting info in logs

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```

```

---

## Performance Testing ✅ / ❌

### Test Multiple Simultaneous Payments

**Objective**: Verify system handles concurrent checkouts

**Steps**:
1. [ ] Open 3-5 browser windows/tabs
2. [ ] Start checkout in each simultaneously
3. [ ] Complete payments within 10 seconds of each other
4. [ ] Verify all process correctly

**Verification**:
- [ ] All payments succeed
- [ ] All webhooks received and processed
- [ ] No duplicate processing
- [ ] No timeout errors
- [ ] All orders created correctly
- [ ] Response times acceptable (< 5s)

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```
Number of concurrent payments: _____
Total processing time: _____
Any errors: _____
```

---

## Integration Verification ✅ / ❌

### Verify Complete Order Flow

**Steps**:
1. [ ] Create order with successful payment
2. [ ] Verify order email sent (if configured)
3. [ ] Check order visible in Medusa Admin
4. [ ] Verify payment visible in Stripe Dashboard
5. [ ] Verify webhook delivery in Stripe Dashboard
6. [ ] Check all order details correct:
   - [ ] Customer info
   - [ ] Line items
   - [ ] Total amount
   - [ ] Payment status
   - [ ] Order status

**Results**: ⏳ / ✅ / ❌  
**Notes**:
```

```

---

## Summary

### Test Results Overview

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Success Flow | ⏳ / ✅ / ❌ | |
| 2. Declined Card | ⏳ / ✅ / ❌ | |
| 3. 3D Secure | ⏳ / ✅ / ❌ | |
| 4. CLI Triggers | ⏳ / ✅ / ❌ | |
| 5. Refund Flow | ⏳ / ✅ / ❌ | |
| 6. Edge Cases | ⏳ / ✅ / ❌ | |
| Performance | ⏳ / ✅ / ❌ | |
| Integration | ⏳ / ✅ / ❌ | |

### Issues Found
```
[List any bugs, errors, or unexpected behavior]

1. 
2. 
3. 
```

### Recommendations
```
[Based on testing, what improvements should be made?]

1. 
2. 
3. 
```

### Sign-off

- [ ] All critical tests pass (Success Flow, Declined Card, Refund)
- [ ] Security tests pass (Signature Verification, Idempotency)
- [ ] Edge cases handled gracefully
- [ ] Performance acceptable
- [ ] Ready to proceed to Step 6 (Documentation) or Step 7 (Production Hardening)

**Tested by**: _________________  
**Date**: _________________  
**Approved**: ☐ Yes  ☐ No (requires fixes)

---

## Next Steps

After completing all tests:

1. ✅ Review results
2. ✅ Fix any issues found
3. ✅ Document lessons learned
4. → Proceed to **Step 7: Production Hardening**
5. → Set up monitoring and alerts
6. → Create production webhook endpoint
7. → Final production smoke test

---

## Reference Commands

```bash
# Start environment
cd medusa-backend && docker compose up -d
cd medusa-backend/my-medusa-store && npm run dev
cd my-medusa-store-storefront && npm run dev

# Start webhook forwarding
stripe listen --forward-to http://localhost:9000/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded

# View Stripe events
stripe events list

# Check logs
tail -f logs/medusa.log | grep "Stripe Webhook"

# Health checks
curl http://localhost:9000/health
curl http://localhost:8000
```

## Test Card Reference

| Card | Purpose |
|------|---------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0025 0000 3155` | 3D Secure (success) |
| `4000 0082 6000 0000` | 3D Secure (fails) |

Full list: https://stripe.com/docs/testing#cards
