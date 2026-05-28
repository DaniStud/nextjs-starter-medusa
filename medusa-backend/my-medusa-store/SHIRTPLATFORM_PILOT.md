# Shirtplatform Pilot Environment

## Base URLs

| Environment | Base URL | Purpose |
|---|---|---|
| **Pilot** | `https://pilot.shirtplatform.com/webservices/rest` | Integration testing — no real fulfillment |
| **Production** | `https://api.shirtplatform.com/webservices/rest` | Live environment — real orders |

---

## Credentials

| Variable | Value |
|---|---|
| `SHIRTPLATFORM_USERNAME` | `10shirts` |
| `SHIRTPLATFORM_PASSWORD` | `es0ZCP6KUe7Y` |
| `SHIRTPLATFORM_ACCOUNT_ID` | `387` |
| `SHIRTPLATFORM_SHOP_ID` | `1597` |

> The same credentials work for both pilot and production.

---

## Authentication (Two-Step)

1. Send `GET /auth` with `Authorization: Basic <base64(username:password)>`
2. Read the `x-auth-token` response header — this is your session token
3. Use `Authorization: Bearer <token>` for all subsequent API calls

**Example:**

```js
const creds = Buffer.from('10shirts:es0ZCP6KUe7Y').toString('base64');

const authRes = await fetch('https://pilot.shirtplatform.com/webservices/rest/auth', {
  headers: { Authorization: 'Basic ' + creds, Accept: 'application/json' }
});

const token = authRes.headers.get('x-auth-token');

// Use token for subsequent requests
const productsRes = await fetch(
  'https://pilot.shirtplatform.com/webservices/rest/accounts/387/shops/1597/products',
  { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }
);
```

---

## Switching Between Pilot and Production

Change one line in `medusa-backend/my-medusa-store/.env`:

```env
# Pilot (testing):
SHIRTPLATFORM_API_URL=https://pilot.shirtplatform.com/webservices/rest

# Production (live):
SHIRTPLATFORM_API_URL=https://api.shirtplatform.com/webservices/rest
```

All other env variables (`USERNAME`, `PASSWORD`, `ACCOUNT_ID`, `SHOP_ID`) stay the same.
