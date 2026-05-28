import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * GET /admin/shirtplatform/preview?product_id=46881&color_id=302485&view=FRONT
 *
 * Proxies a blank-shirt preview image from Shirtplatform (which requires auth).
 * The admin UI uses this to show a live shirt preview in the wizard.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = Number(req.query.product_id)
  const colorId = Number(req.query.color_id)
  const viewPosition = (req.query.view as string)?.toUpperCase() || "FRONT"

  if (!Number.isFinite(productId) || productId <= 0) {
    return res.status(400).json({ error: "product_id is required" })
  }

  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  try {
    // If we have both color and view, try to get the specific view+color image
    if (Number.isFinite(colorId) && colorId > 0) {
      const detail = await shirtplatform.getBaseProductDetail(productId)
      const matchingView = detail.views.find(
        (v) => v.position.toUpperCase() === viewPosition
      )
      if (matchingView) {
        const preview = await shirtplatform.getProductViewColorImage(
          productId,
          matchingView.id,
          colorId
        )
        res.setHeader("Content-Type", preview.contentType)
        res.setHeader("Cache-Control", "public, max-age=3600")
        return res.send(preview.buffer)
      }
    }

    // Fallback: default product preview
    const preview = await shirtplatform.getProductPreviewImage(productId)
    res.setHeader("Content-Type", preview.contentType)
    res.setHeader("Cache-Control", "public, max-age=3600")
    return res.send(preview.buffer)
  } catch (err: any) {
    return res.status(502).json({
      error: "Failed to fetch preview image",
      message: err?.message ?? String(err),
    })
  }
}
