import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../modules/shirtplatform"
import type ShirtplatformModuleService from "../../../modules/shirtplatform/service"

/**
 * GET /admin/sp-test
 *
 * Temporary discovery route — lists products from Shirtplatform pilot
 * and returns expanded details for Stanley/Stella items.
 *
 * Query params:
 *   ?search=Stanley  — filter product names (default: show all)
 *   ?productId=12345 — get expanded details for a specific product
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sp = req.scope.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)
  const search = (req.query.search as string) ?? ""
  const productId = req.query.productId as string | undefined

  try {
    // If a specific product ID is requested, return full expanded data
    if (productId) {
      const expanded = await sp.getProductExpanded(Number(productId))

      // Also fetch assigned print technologies
      const printTechs = await sp.request(
        `/accounts/${sp.accountId}/shops/${sp.shopId}/products/${productId}/assignedPrintTechnologies`
      )

      // Also fetch assigned views
      const views = await sp.request(
        `/accounts/${sp.accountId}/shops/${sp.shopId}/products/${productId}/assignedViews`
      )

      return res.json({
        product: expanded,
        printTechnologies: printTechs,
        assignedViews: views,
      })
    }

    // List all products and optionally filter by name
    const products = await sp.listAllProducts()

    const filtered = search
      ? products.filter((p: any) => {
          const name = (p.name || "").toLowerCase()
          return name.includes(search.toLowerCase())
        })
      : products

    return res.json({
      total: products.length,
      matched: filtered.length,
      search: search || "(all)",
      products: filtered.map((p: any) => ({
        id: p.id,
        name: p.name,
        active: p.active,
      })),
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
