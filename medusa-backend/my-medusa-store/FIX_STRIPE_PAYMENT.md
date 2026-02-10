# 🔧 Fix Stripe Payment Not Showing Issue

## The Problem

You're using **LIVE Stripe keys** (`sk_live_...` and `pk_live_...`) for local development. For testing, you need **TEST keys** (`sk_test_...` and `pk_test_...`).

**Current keys in `.env`:**
- ❌ `STRIPE_API_KEY=sk_live_...` (LIVE key)
- ❌ `NEXT_PUBLIC_STRIPE_KEY=pk_live_...` (LIVE key)

## Solution: Get Test Keys from Stripe Dashboard

### Step 1: Get Stripe Test Keys

1. **Open Stripe Dashboard**: https://dashboard.stripe.com/test/apikeys
   - Make sure you're in **TEST MODE** (toggle in top-right corner)

2. **Copy the keys**:
   - **Publishable key**: `pk_test_...` (starts with `pk_test_`)
   - **Secret key**: Click "Reveal test key" → `sk_test_...` (starts with `sk_test_`)

### Step 2: Update Backend .env File

**File**: `medusa-backend/my-medusa-store/.env`

Replace the Stripe keys with your **TEST** keys:

```env
# Stripe TEST keys for local development
STRIPE_API_KEY=sk_test_YOUR_TEST_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_5b72793dbccbebbc6ac72c19ac83d097100ae9b6ca6c065a3b4e6ec98525f66e
NEXT_PUBLIC_STRIPE_KEY=pk_test_YOUR_TEST_PUBLISHABLE_KEY_HERE
```

**Keep the webhook secret** - it's already correct from Stripe CLI.

### Step 3: Update Frontend .env.local

**File**: `.env.local` (in your storefront root)

```env
NEXT_PUBLIC_STRIPE_KEY=pk_test_YOUR_TEST_PUBLISHABLE_KEY_HERE
```

### Step 4: Restart Backend

```powershell
# Stop backend (Ctrl+C in the terminal running npm run dev)
# Then restart:
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa\medusa-backend\my-medusa-store
npm run dev
```

### Step 5: Restart Storefront (if running)

```powershell
# Stop storefront (Ctrl+C)
# Then restart:
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa
npm run dev
```

---

## Verify Stripe is Enabled

After restarting, check Medusa Admin:

1. Open: http://localhost:9000/app
2. Login: `admin@example.com` / `supersecret`
3. Go to: **Settings → Regions**
4. Click on your region (e.g., "United States")
5. Scroll to **Payment Providers**
6. Verify **Stripe** is listed and enabled

If Stripe is not listed:
- Make sure backend restarted successfully
- Check logs for errors: `npm run dev` output
- Verify keys are correct (no extra spaces/line breaks)

---

## Test Payment Flow

After fixing:

1. **Start webhook forwarding**:
   ```powershell
   cd C:\stripe
   .\stripe listen --forward-to http://localhost:9000/stripe/webhook
   ```

2. **Open storefront**: http://localhost:8000

3. **Add product to cart** → **Checkout**

4. **You should now see**:
   - ✅ Credit card payment option (Stripe)
   - ❌ ~~Manual pay (test only)~~ (should still be there, but Stripe should appear too)

5. **Enter test card**:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`

6. **Complete payment**

7. **Check Terminal 2** (Stripe CLI):
   ```
   --> payment_intent.succeeded [evt_xxxxx]
   <-- [200] POST http://localhost:9000/stripe/webhook
   ```

8. **Check Backend logs**:
   ```
   [Stripe Webhook] payment_intent.succeeded: pi_xxxxx
   [Stripe Webhook] Found payment collection: paycol_xxxxx
   [Stripe Webhook] Payment captured successfully
   ```

---

## Quick Commands

### Update .env with test keys
```powershell
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa\medusa-backend\my-medusa-store

# Open .env in VS Code
code .env

# Replace:
# STRIPE_API_KEY=sk_live_... 
# with:
# STRIPE_API_KEY=sk_test_...

# Replace:
# NEXT_PUBLIC_STRIPE_KEY=pk_live_...
# with:
# NEXT_PUBLIC_STRIPE_KEY=pk_test_...

# Save and close
```

### Restart everything
```powershell
# Terminal 1: Backend
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa\medusa-backend\my-medusa-store
npm run dev

# Terminal 2: Stripe webhooks
cd C:\stripe
.\stripe listen --forward-to http://localhost:9000/stripe/webhook

# Terminal 3: Storefront
cd D:\web-dev-dani\10shirt\next\nextjs-starter-medusa
npm run dev
```

---

## Troubleshooting

### "Stripe still not showing"

**Check backend logs for errors**:
```powershell
# Look for errors like:
# "Invalid API Key provided"
# "No such API key"
```

**Verify keys are correct**:
- No extra spaces
- No line breaks
- Keys start with `sk_test_` and `pk_test_`
- Keys are from the same Stripe account

**Clear cache and restart**:
```powershell
# Stop backend
# Delete node_modules/.cache (if exists)
rm -r node_modules/.cache
# Restart backend
npm run dev
```

### "Payment option appears but cards don't work"

- Make sure **frontend** `.env.local` also has `pk_test_...` key
- Restart storefront after updating
- Check browser console for Stripe errors

### "Webhook not receiving events"

- Verify webhook secret hasn't changed
- Restart Stripe CLI forwarding
- Check backend is running on port 9000

---

## Production vs Test Keys

| Environment | Secret Key | Publishable Key | Use Case |
|-------------|------------|-----------------|----------|
| **Test** | `sk_test_...` | `pk_test_...` | Local development, testing |
| **Live** | `sk_live_...` | `pk_live_...` | Production only |

✅ **Use TEST keys** for local development  
⚠️ **NEVER** commit keys to Git  
🔒 **Use LIVE keys** only in production with proper security

---

## Next Steps

After fixing:

1. ✅ Verify Stripe appears as payment option
2. ✅ Test successful payment with test card
3. ✅ Verify webhook receives events
4. ✅ Check order created in Medusa Admin
5. → Continue with Step 5 testing scenarios

---

**Need test keys?** → https://dashboard.stripe.com/test/apikeys  
**Stripe test cards** → https://stripe.com/docs/testing#cards
