import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createHmac, timingSafeEqual } from "crypto"

/**
 * POST /store/shirtplatform-webhook
 *
 * Receives fulfillment event notifications from Shirtplatform.
 * Verifies the x-shirtplatform-hmac-sha256 signature using SHIRTPLATFORM_WEBHOOK_SECRET.
 *
 * Supported topics:
 *   - orders/fulfilled  → stores tracking info in Medusa order metadata
 *
 * Always returns 200 on success so Shirtplatform does not retry.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = (req.scope as any).resolve("logger") as any

  // -------------------------------------------------------------------------
  // 1. HMAC signature verification
  // -------------------------------------------------------------------------
  const secret = process.env.SHIRTPLATFORM_WEBHOOK_SECRET

  if (secret) {
    const signature = req.headers["x-shirtplatform-hmac-sha256"] as string | undefined

    if (!signature) {
      logger.warn("[SP Webhook] Missing x-shirtplatform-hmac-sha256 header")
      return res.status(401).json({ error: "Missing signature" })
    }

    // Get raw body for HMAC calculation (same approach as Stripe webhook)
    const expressReq = req as any
    let rawBody: Buffer

    if (expressReq.rawBody && Buffer.isBuffer(expressReq.rawBody)) {
      rawBody = expressReq.rawBody
    } else if (typeof expressReq.rawBody === "string") {
      rawBody = Buffer.from(expressReq.rawBody, "utf8")
    } else if (Buffer.isBuffer(expressReq.body)) {
      rawBody = expressReq.body
    } else if (typeof expressReq.body === "string") {
      rawBody = Buffer.from(expressReq.body, "utf8")
    } else {
      rawBody = Buffer.from(JSON.stringify(expressReq.body ?? ""), "utf8")
    }

    const expectedSig = createHmac("sha256", secret).update(rawBody).digest("hex")

    let signaturesMatch = false
    try {
      signaturesMatch = timingSafeEqual(
        Buffer.from(signature, "utf8"),
        Buffer.from(expectedSig, "utf8")
      )
    } catch {
      signaturesMatch = false
    }

    if (!signaturesMatch) {
      logger.warn("[SP Webhook] Invalid HMAC signature — request rejected")
      return res.status(401).json({ error: "Invalid signature" })
    }
  } else {
    logger.warn("[SP Webhook] SHIRTPLATFORM_WEBHOOK_SECRET not set — skipping signature check")
  }

  // -------------------------------------------------------------------------
  // 2. Parse payload
  // -------------------------------------------------------------------------
  const body = req.body as any
  const topic: string = body?.topic ?? ""

  logger.info(`[SP Webhook] Received topic: ${topic}`)

  if (topic === "orders/fulfilled") {
    await handleOrderFulfilled(body, req.scope as any, logger)
  } else {
    logger.info(`[SP Webhook] Unhandled topic: ${topic}`)
  }

  // Always return 200 so Shirtplatform stops retrying
  return res.status(200).json({ received: true })
}

// ---------------------------------------------------------------------------
// Handler: orders/fulfilled
// ---------------------------------------------------------------------------

async function handleOrderFulfilled(body: any, container: any, logger: any) {
  try {
    const orderModule = container.resolve(Modules.ORDER) as any

    // The Shirtplatform order uniqueId is the Medusa order ID (set during order creation)
    const spOrderId: number | undefined = body?.id
    const uniqueId: string | undefined = body?.uniqueId

    if (!uniqueId && !spOrderId) {
      logger.warn("[SP Webhook] orders/fulfilled payload missing both id and uniqueId")
      return
    }

    // -----------------------------------------------------------------------
    // Find Medusa order by uniqueId (= Medusa order ID) or by metadata
    // -----------------------------------------------------------------------
    let medusaOrder: any

    if (uniqueId) {
      const results = await orderModule.listOrders(
        { id: uniqueId },
        { select: ["id", "metadata"] }
      )
      medusaOrder = results?.[0]
    }

    // Fallback: search by stored shirtplatform_order_id in metadata
    if (!medusaOrder && spOrderId) {
      const allOrders = await orderModule.listOrders(
        {},
        { select: ["id", "metadata"] }
      )
      medusaOrder = allOrders?.find(
        (o: any) => o.metadata?.shirtplatform_order_id === spOrderId
      )
    }

    if (!medusaOrder) {
      logger.warn(`[SP Webhook] Could not find Medusa order for SP order ${spOrderId} / uniqueId ${uniqueId}`)
      return
    }

    // -----------------------------------------------------------------------
    // Extract tracking info from fulfillments array
    // -----------------------------------------------------------------------
    const fulfillments: any[] = body?.fulfillments ?? body?.orderFulfillments ?? []
    const firstFulfillment = fulfillments[0]
    const trackingNumber: string | undefined = firstFulfillment?.trackingNumber
    const trackingUrl: string | undefined = firstFulfillment?.trackingUrl

    // -----------------------------------------------------------------------
    // Update Medusa order metadata with tracking data
    // -----------------------------------------------------------------------
    await orderModule.updateOrders([
      {
        id: medusaOrder.id,
        metadata: {
          ...(medusaOrder.metadata ?? {}),
          shirtplatform_order_id: spOrderId,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          shirtplatform_fulfilled_at: new Date().toISOString(),
        },
      },
    ])

    logger.info(
      `[SP Webhook] ✅ Order ${medusaOrder.id} marked fulfilled — tracking: ${trackingNumber ?? "N/A"}`
    )
  } catch (err: any) {
    logger.error(`[SP Webhook] Error handling orders/fulfilled: ${err.message}`)
  }
}
