# Step 5 Testing Commands - Quick Start

## 🚀 Quick Setup (Copy & Paste)

### Terminal 1: Start Docker + Backend
```powershell
# Navigate to project root
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa

# Start Postgres and Redis
cd medusa-backend
docker compose up -d

# Start Medusa backend
cd my-medusa-store
npm run dev
```

**Expected**: Backend running on `http://localhost:9000`

---

### Terminal 2: Start Stripe Webhook Forwarding
```powershell
# Navigate to Stripe CLI directory
cd C:\stripe

# Make sure you're logged in to Stripe CLI
.\stripe login

# Start forwarding webhooks
.\stripe listen --forward-to http://localhost:9000/stripe/webhook
```

**Expected**: 
```
> Ready! Your webhook signing secret is whsec_xxxxx
```

**IMPORTANT**: Copy the `whsec_xxxxx` and ensure it matches your `.env` file!

> **Note**: Stripe CLI is in `C:\stripe\` - use `.\stripe` to run commands from that directory

---

### Terminal 3: Start Storefront (if testing UI)
```powershell
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa

# Check if storefront directory exists
# Adjust path based on your setup
cd my-medusa-store-storefront  # or wherever your Next.js storefront is
npm run dev
```

**Expected**: Storefront running on `http://localhost:8000`

---

## ✅ Pre-Flight Checks

Run these commands to verify everything is ready:

```powershell
# Check Docker is running
docker ps

# Should show postgres and redis containers

# Check backend health
curl http://localhost:9000/health

# Check Stripe CLI (from C:\stripe directory)
cd C:\stripe
.\stripe --version
# Should show: stripe version 1.35.0

# Check webhook forwarding status
# (Should see events in Terminal 2 when you trigger tests)
```

---

## 🧪 Test 1: Stripe CLI Trigger (Easiest First!)

This is the quickest way to verify your webhook handler works.

##Navigate to Stripe CLI directory
cd C:\stripe

# Trigger a successful payment event
.\```powershell
# Trigger a successful payment event
stripe trigger payment_intent.succeeded
```

### What to Watch For

**Terminal 2 (Stripe CLI)** should show:
```
--> payment_intent.succeeded [evt_xxxxx]
<-- [200] POST http://localhost:9000/stripe/webhook
```

**Terminal 1 (Backend)** should show:
```
[Stripe Webhook] payment_intent.succeeded: pi_xxxxx
[Stripe Webhook] No payment collection found for payment_intent pi_xxxxx
```

> **Note**: It's NORMAL to see "No payment collection found" because we triggered a test event without creating a real order. This means the webhook handler is working correctly!

---

cd C:\stripe
.\stripe trigger payment_intent.payment_failed
```

**Backend should show**:
```
[Stripe Webhook] payment_intent.payment_failed: pi_xxxxx
```

---

## 🧪 Test 3: Refund Trigger

```powershell
cd C:\stripe
.\## 🧪 Test 3: Refund Trigger

```powershell
stripe trigger charge.refunded
```

**Backend should show**:
```
[Stripe Webhook] charge.refunded: ch_xxxxx
```

---

## 🧪 Test 4: Full Checkout Flow (Requires Storefront)

### Prerequisites
- Storefront running on port 8000
- Products seeded (ran `npm run seed`)
- Stripe publishable key configured in storefront `.env.local`

### Steps
1. Open browser: `http://localhost:8000`
2. Add product to cart
3. Go to checkout
4. Enter test card:
   - **Card**: `4242 4242 4242 4242`
   - **Expiry**: `12/34`
   - **CVC**: `123`
   - **Postal**: `12345`
5. Complete payment

### What to Watch For

**Frontend**: Should show payment success

**Terminal 2 (Stripe)**: 
```
--> payment_intent.succeeded [evt_xxxxx]
<-- [200] POST http://localhost:9000/stripe/webhook
```

**Terminal 1 (Backend)**:
```
[Stripe Webhook] payment_intent.succeeded: pi_xxxxx
[Stripe Webhook] Found payment collection: paycol_xxxxx
[Stripe Webhook] Payment pay_xxxxx captured successfully
[Stripe Webhook] Order order_xxxxx marked as paid
```

**Medusa Admin** (`http://localhost:9000/app`):
- Order should appear with status "completed"
- Payment status should be "captured"

---

## 🧪 Test 5: Declined Card

Same as Test 4, but use this card instead:
- **Card**: `4000 0000 0000 0002`

**Expected**: 
- Payment fails on frontend
- Backend logs show `payment_intent.payment_failed`
- Error details logged

---

## 🧪 Test 6: 3D Secure

Same as Test 4, but use this card:
- **Card**: `4000 0025 0000 3155`

**Expected**:
- 3D Secure modal appears
- Click "Complete" to authenticate
- Payment succeeds
- Backend processes `payment_intent.succeeded`

cd C:\stripe

# Trigger the same event twice
.\stripe trigger payment_intent.succeeded
.\## 🧪 Test 7: Idempotency (Duplicate Prevention)

```powershell
# Trigger the same event twice
stripe trigger payment_intent.succeeded
stripe events list --limit 1

# Copy the event ID (evt_xxxxx) from the output
# Then resend it from Stripe Dashboard or wait for auto-retry
```

**Expected**:
- First event processes normally
- Second event shows: `Event evt_xxxxx already processed, skipping`
- Response includes: `{received: true, status: "duplicate"}`

---

## 🧪 Test 8: Invalid Signature (Security)

```powershell
curl -X POST http://localhost:9000/stripe/webhook `
  -H "Content-Type: application/json" `
  -H "stripe-signature: invalid_signature" `
  -d '{\"type\":\"payment_intent.succeeded\"}'
```

**Expected**:
- HTTP 400 error
- Backend logs: `Signature verification failed`
- No payment processing

---

cd C:\stripe
.\stripe events list

# View specific event details
.\# View recent Stripe events
stripe events list

# View specific event details
stripe events retrieve evt_xxxxx

# Check backend logs (if using log file)
Get-Content -Tail 50 -Wait logs\medusa.log

# Check what's running on ports
netstat -an | Select-String "9000|8000"

# Test webhook endpoint (should return 404 for GET)
curl http://localhost:9000/stripe/webhook
```

---

## ⚠️ Troubleshooting

### Webhook Not Received
```powershell
# Check Stripe CLI is forwarding
# Terminal 2 should show "Ready! Listening..."

cd C:\stripe
.\stripe listen --forward-to http://localhost:9000/stripe/webhook
```

### Signature Verification Fails
```powershell
# Get new webhook secret
cd C:\stripe
.\```

### Signature Verification Fails
```powershell
# Get new webhook secret
stripe listen --forward-to http://localhost:9000/stripe/webhook
# Copy the whsec_xxxxx

# Update .env file
# Open medusa-backend/my-medusa-store/.env
# Set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Restart backend (Ctrl+C in Terminal 1, then npm run dev)
```

### Backend Won't Start
```powershell
# Check if port 9000 is already in use
netstat -ano | Select-String "9000"

# Kill process if needed
Stop-Process -Id <PID>

# Or use different port in medusa-config
```

### Storefront Can't Connect to Backend
```powershell
# Verify backend URL in storefront .env.local
# Should be: MEDUSA_BACKEND_URL=http://localhost:9000

# Check publishable key is set
# NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxx

# Restart storefront after env changes
```

---

## 📋 Testing Checklist Progress

Use `TESTING_CHECKLIST.md` to track your progress:

```powershell
# Open checklist
code TESTING_CHECKLIST.md

# Mark tests as complete as you go
```

---

## 🎯 Success Criteria

You've completed Step 5 when:

- ✅ Stripe CLI triggers work (Tests 1-3)
- ✅ Full checkout succeeds (Test 4)
- ✅ Declined card handled (Test 5)
- ✅ 3D Secure works (Test 6)
- ✅ Idempotency works (Test 7)
- ✅ Security verified (Test 8)
- ✅ All logs show expected output
- ✅ No errors or crashes

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. ✅ Mark Step 5 as complete
2. → Proceed to **Step 7: Production Hardening**
3. → Configure production webhook endpoint in Stripe Dashboard
4. → Set up monitoring and alerts
5. → Create production runbook

---

## 📞 Quick Reference

| Component | URL | Command |
|-----------|-----|---------|
| Backend | http://localhost:9000 | `cd medusa-backend/my-medusa-store && npm run dev` |
| Admin | http://localhost:9000/app | Login: admin@example.com / supersecret |
| Storefront | http://localhost:8000 | `cd storefront && npm run dev` |
| Stripe CLI | C:\stripe | `cd C:\stripe && .\stripe listen --forward-to http://localhost:9000/stripe/webhook` |

**Test Cards**:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

**Helper Script** (easier than typing full paths):
```powershell
# From project root, use the helper script:
.\medusa-backend\my-medusa-store\stripe-test.ps1 listen
.\medusa-backend\my-medusa-store\stripe-test.ps1 trigger-success
.\medusa-backend\my-medusa-store\stripe-test.ps1 trigger-fail
.\medusa-backend\my-medusa-store\stripe-test.ps1 events
```

**Environment Files**:
- Backend: `medusa-backend/my-medusa-store/.env`
- Storefront: `storefront/.env.local`

---

Ready to start? Begin with **Test 1** (Stripe CLI Trigger) - it's the easiest! 🎉
