import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      // Preserve the exact raw request bytes for Shirtplatform HMAC verification.
      // Uses Medusa's native body parser (req.rawBody) — a custom stream reader
      // hangs when the body has already been consumed.
      matcher: "/store/shirtplatform-webhook",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
    {
      // Preserve raw body for Stripe signature verification (constructEvent
      // requires the exact bytes Stripe signed — a re-serialized JSON body fails).
      matcher: "/stripe/webhook",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
    {
      // Increase body size limit for base64 motive uploads (~18 MB binary → ~25 MB base64)
      matcher: "/admin/shirtplatform/motives",
      bodyParser: { sizeLimit: "30mb" },
    },
  ],
})
