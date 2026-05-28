import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../../../modules/shirtplatform/service"

/**
 * GET /admin/shirtplatform/base-products/:id/debug
 *
 * Returns the RAW API responses from Shirtplatform so we can inspect the
 * actual JSON structure (key names, nesting, single-item-vs-array).
 * Use this to diagnose mapping issues.
 *
 * ⚠ Development-only. Remove or gate behind NODE_ENV before production.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  const productId = Number(req.params.id)
  if (!Number.isFinite(productId) || productId <= 0) {
    return res.status(400).json({ error: "Invalid id" })
  }

  try {
    // Call the three raw endpoints the mapping depends on
    const [expanded, skus, prices] = await Promise.all([
      shirtplatform.getProductExpanded(productId),
      shirtplatform.getProductSkus(productId),
      shirtplatform.getProductPrices(productId),
    ])

    // Also fetch the raw expanded response directly so we can see ALL keys
    const rawExpanded = await shirtplatform.request<any>(
      `/accounts/${shirtplatform.accountId}/shops/${shirtplatform.shopId}/products/expanded/${productId}`
    )

    // Fetch the RAW SKU response to inspect pagination
    const rawSkus = await shirtplatform.request<any>(
      `/accounts/${shirtplatform.accountId}/shops/${shirtplatform.shopId}/products/${productId}/sku`
    )

    return res.status(200).json({
      _note: "Raw Shirtplatform API responses for debugging",
      raw_expanded_full: rawExpanded,
      raw_skus_full: rawSkus,
      parsed_expanded: expanded,
      parsed_skus: skus,
      parsed_skus_count: skus.length,
      parsed_prices: prices,
      _key_inspection: {
        expanded_top_level_keys: Object.keys(rawExpanded ?? {}),
        expanded_inner_keys: Object.keys(rawExpanded?.productExpanded ?? rawExpanded ?? {}),
        colors_key_type: typeof (expanded as any)?.assignedColors,
        colors_inner_keys: Object.keys((expanded as any)?.assignedColors ?? {}),
        sizes_key_type: typeof (expanded as any)?.assignedSizes,
        sizes_inner_keys: Object.keys((expanded as any)?.assignedSizes ?? {}),
        raw_skus_top_keys: Object.keys(rawSkus ?? {}),
        raw_skus_paged_keys: Object.keys(rawSkus?.pagedData ?? {}),
      },
    })
  } catch (err: any) {
    return res.status(502).json({
      error: "SP API call failed",
      message: err?.message ?? String(err),
    })
  }
}
