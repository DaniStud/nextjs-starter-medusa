import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * GET /admin/shirtplatform/preview?product_id=46881&color_id=302485&view=FRONT
 *
 * Proxies a blank-shirt preview image from Shirtplatform (which requires auth).
 * The admin UI uses this to show a live shirt preview in the wizard.
 *
 * Optional motive params (for designed/composed preview):
 *   &motive_url=...  — publicly accessible URL of the motive image
 *   &position_top=...&position_left=...&position_right=...  — placement in mm
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = Number(req.query.product_id)
  const colorId = Number(req.query.color_id)
  const viewPosition = (req.query.view as string)?.toUpperCase() || "FRONT"
  const motiveUrl = req.query.motive_url as string | undefined
  const positionTop = req.query.position_top as string | undefined
  const positionLeft = req.query.position_left as string | undefined
  const positionRight = req.query.position_right as string | undefined

  if (!Number.isFinite(productId) || productId <= 0) {
    return res.status(400).json({ error: "product_id is required" })
  }

  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  try {
    // If a motive URL is provided, try the designed product preview first
    if (motiveUrl && Number.isFinite(colorId) && colorId > 0) {
      try {
        const designed = await shirtplatform.getDesignedProductPreview(
          productId,
          colorId,
          viewPosition,
          motiveUrl,
          undefined,
          positionLeft,
          positionRight,
          positionTop
        )
        res.setHeader("Content-Type", designed.contentType)
        res.setHeader("Cache-Control", "public, max-age=300")
        return res.send(designed.buffer)
      } catch (designErr: any) {
        console.warn(`[SP] designedProducts/preview failed, falling back to blank: ${designErr.message}`)
        // Fall through to blank shirt preview
      }
    }

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
