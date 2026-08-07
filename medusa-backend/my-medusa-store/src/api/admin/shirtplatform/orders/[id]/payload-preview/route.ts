import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../../../modules/shirtplatform/service"
import { mapOrderToCreatorSEInputs } from "../../../../../../modules/shirtplatform/order-mapper"

/**
 * GET /admin/shirtplatform/orders/:id/payload-preview
 *
 * DRY RUN — returns the exact CreatorSE deferred-order payload that WOULD be
 * sent to Shirtplatform for a given Medusa order, without capturing payment or
 * calling Shirtplatform. Use it to verify the payload structure (front-only
 * compositions, shipping carrier, sender name, print position) and to hand a
 * concrete example to Shirtplatform before placing a real order.
 *
 * Query params:
 *   financialStatus   default "PAID" — value placed in the previewed payload.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  if (!orderId) {
    return res.status(400).json({ error: "order id is required" })
  }

  const financialStatus =
    typeof req.query.financialStatus === "string" ? req.query.financialStatus : "PAID"

  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)
  const query = req.scope.resolve("query") as any

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "metadata",
        "items.*",
        "items.variant.*",
        "items.variant.metadata",
        "shipping_address.*",
        "billing_address.*",
      ],
      filters: { id: orderId },
    })

    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found` })
    }

    const { customer, shippingCountryCode, designs, skippedItems } =
      mapOrderToCreatorSEInputs(order)

    if (designs.length === 0) {
      return res.status(422).json({
        error: "No line items on this order could be mapped to Shirtplatform designs",
        skipped_items: skippedItems,
      })
    }

    const payload = shirtplatform.buildCreatorSEPayload({
      uniqueId: order.id,
      financialStatus,
      customer,
      shippingCountryCode,
      designs,
    })

    return res.status(200).json({
      dry_run: true,
      shipping_carrier_id: shirtplatform.shippingCarrierId,
      skipped_items: skippedItems,
      endpoint: `POST /accounts/${shirtplatform.accountId}/shops/${shirtplatform.shopId}/orders/usingCreatorSE`,
      payload,
    })
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to build Shirtplatform payload preview",
      message: err?.message ?? String(err),
    })
  }
}
