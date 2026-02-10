# Stripe Webhook Quick Reference

## 🚀 Quick Start

```bash
# 1. Start backend
cd medusa-backend/my-medusa-store && npm run dev

# 2. Forward webhooks
stripe listen --forward-to http://localhost:9000/stripe/webhook

# 3. Test
stripe trigger payment_intent.succeeded
```

## 📁 Files

| File | Purpose |
|------|---------|
| `src/api/stripe/webhook/route.ts` | Main webhook handler |
| `src/api/webhooks/stripe.ts` | Alternative Express handler |
| `src/api/stripe/utils.ts` | Utility functions |
| `docs/STRIPE_WEBHOOKS.md` | Implementation guide |
| `docs/STRIPE_TESTING.md` | Testing scenarios |
| `docs/STEP_4_SUMMARY.md` | Implementation summary |

## 🎯 Supported Events

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Capture payment, mark order paid |
| `payment_intent.payment_failed` | Log error, mark payment failed |
| `charge.refunded` | Update payment, mark order refunded |
| `checkout.session.completed` | Log session (optional) |

## 🔒 Security Features

- ✅ Signature verification (required)
- ✅ Idempotency (prevents duplicates)
- ✅ Raw body parsing (for signatures)
- ✅ Error handling (graceful failures)
- ✅ Audit logging (all events)

## 🧪 Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0025 0000 3155` | 🔐 3D Secure |

## 📊 Monitoring

```bash
# Check webhook endpoint
curl http://localhost:9000/stripe/webhook

# View recent events
stripe events list

# Watch logs
tail -f logs/medusa.log | grep "Stripe Webhook"
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not received | Check Stripe CLI, verify port 9000 |
| Signature fails | Update `STRIPE_WEBHOOK_SECRET` |
| Payment not captured | Check metadata: `stripe_payment_intent_id` |
| Order not found | Normal (webhook arrives early), retry succeeds |

## 📞 Environment Variables

```env
# Required
STRIPE_API_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Frontend
NEXT_PUBLIC_STRIPE_KEY=pk_test_xxxxx
```

## 🎬 Production Checklist

- [ ] Configure webhook in Stripe Dashboard
- [ ] Set production webhook secret
- [ ] Test with small payment ($1)
- [ ] Monitor for 24 hours
- [ ] Set up error alerts
- [ ] Document team runbook

## 📚 Documentation

- **Implementation**: [STRIPE_WEBHOOKS.md](STRIPE_WEBHOOKS.md)
- **Testing**: [STRIPE_TESTING.md](STRIPE_TESTING.md)
- **Summary**: [STEP_4_SUMMARY.md](STEP_4_SUMMARY.md)
- **Stripe Docs**: https://stripe.com/docs/webhooks
- **Medusa Docs**: https://docs.medusajs.com

## 🐛 Common Errors

```
Signature verification failed
→ Update STRIPE_WEBHOOK_SECRET, restart backend

No payment collection found
→ Normal (early webhook), Stripe will retry

Event already processed
→ Idempotency working correctly (duplicate rejected)
```

## 💡 Tips

1. **Always verify signatures** in production
2. **Use idempotency** to prevent double-processing
3. **Log everything** for debugging
4. **Handle missing orders** gracefully
5. **Test all scenarios** before production

## 🔗 Related Commands

```bash
# Get webhook secret
stripe listen --forward-to http://localhost:9000/stripe/webhook

# Trigger events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded

# View event details
stripe events retrieve evt_xxxxx

# Resend event
stripe events resend evt_xxxxx
```

## ⚡ Performance

- **Response time**: < 5s (recommended)
- **Timeout**: 30s (Stripe limit)
- **Retries**: Automatic (up to 3 days)
- **Idempotency**: Last 1000 events

## 🎯 Next Steps

1. ✅ Step 4: Implement webhook logic (COMPLETE)
2. ⏳ Step 5: Test payment scenarios
3. ⏳ Step 6: Add documentation
4. ⏳ Step 7: Production hardening
5. ⏳ Step 8: Go-live

---

**Need Help?** See [STRIPE_TESTING.md](STRIPE_TESTING.md) for detailed test scenarios.
