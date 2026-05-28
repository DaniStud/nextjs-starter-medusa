import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../../modules/shirtplatform/service"

/**
 * GET /admin/shirtplatform/base-products/:id
 *
 * Returns the expanded detail (colors, sizes, available SKUs, base price) for
 * a single Shirtplatform base product. The admin product-builder uses this to
 * render the color/size selectors after a base product is picked.
 *
 * Query params:
 *   refresh=1   Bypass cache and re-fetch from Shirtplatform.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  const idParam = req.params.id
  const productId = Number(idParam)
  if (!Number.isFinite(productId) || productId <= 0) {
    return res.status(400).json({ error: "Invalid base product id" })
  }

  const refresh = req.query.refresh === "1" || req.query.refresh === "true"

  try {
    const detail = await shirtplatform.getBaseProductDetail(productId, refresh)
    return res.status(200).json({ base_product: detail })
  } catch (err: any) {
    return res.status(502).json({
      error: "Failed to fetch Shirtplatform base product",
      message: err?.message ?? String(err),
    })
  }
}
