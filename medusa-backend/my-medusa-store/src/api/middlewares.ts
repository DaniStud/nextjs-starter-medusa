import { defineMiddlewares } from "@medusajs/framework/http"
import type {
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from "@medusajs/framework/http"

/**
 * Capture the raw request body as a Buffer before JSON parsing.
 * Required for HMAC signature verification on the Shirtplatform webhook route.
 */
function captureRawBody(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const chunks: Buffer[] = []
  req.on("data", (chunk: Buffer) => chunks.push(chunk))
  req.on("end", () => {
    ;(req as any).rawBody = Buffer.concat(chunks)
    next()
  })
  req.on("error", next)
}

export default defineMiddlewares({
  routes: [
    {
      // Preserve raw body for Shirtplatform HMAC verification
      matcher: "/store/shirtplatform-webhook",
      middlewares: [captureRawBody],
    },
    {
      // Increase body size limit for base64 motive uploads (~18 MB binary → ~25 MB base64)
      matcher: "/admin/shirtplatform/motives",
      bodyParser: { sizeLimit: "30mb" },
    },
  ],
})
