import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * GET /admin/shirtplatform/base-products
 *
 * Returns a lightweight list of Shirtplatform base shirt templates that an
 * admin can build Medusa products on top of. Cached in Redis for 1h.
 *
 * Query params:
 *   refresh=1   Bypass cache and re-fetch from Shirtplatform.
 *   q=<text>    Case-insensitive substring filter on the product name.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  const refresh = req.query.refresh === "1" || req.query.refresh === "true"
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : ""

  try {
    let summaries = await shirtplatform.getBaseProductSummaries(refresh)
    if (q) {
      summaries = summaries.filter((s) => s.name.toLowerCase().includes(q))
    }
    return res.status(200).json({ base_products: summaries, count: summaries.length })
  } catch (err: any) {
    return res.status(502).json({
      error: "Failed to fetch Shirtplatform base catalog",
      message: err?.message ?? String(err),
    })
  }
}
