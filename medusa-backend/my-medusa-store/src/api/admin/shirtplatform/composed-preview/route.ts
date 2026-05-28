import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * POST /admin/shirtplatform/composed-preview
 *
 * Generates a composed preview image (motive on shirt) using the throw-away
 * order method on Shirtplatform. Returns the image as a base64 data-URL.
 *
 * Body:
 *   sp_product_id  — SP base product id
 *   color_id       — SP assigned color id
 *   size_id        — SP assigned size id (any valid size for this product)
 *   view_position  — "FRONT" | "BACK"
 *   motive_url     — URL of the motive image (fetched server-side → base64)
 *   motive_filename— original filename
 *   position_top   — mm, optional
 *   position_left  — mm, optional
 *   position_right — mm, optional
 */

type Body = {
  sp_product_id?: number
  color_id?: number
  size_id?: number
  view_position?: string
  motive_url?: string
  motive_filename?: string
  position_top?: string
  position_left?: string
  position_right?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Body

  const spProductId = Number(body.sp_product_id)
  const colorId = Number(body.color_id)
  const sizeId = Number(body.size_id)
  if (
    !Number.isFinite(spProductId) ||
    !Number.isFinite(colorId) ||
    !Number.isFinite(sizeId)
  ) {
    return res
      .status(400)
      .json({ error: "sp_product_id, color_id, and size_id are required" })
  }

  const motiveUrl = body.motive_url
  if (!motiveUrl) {
    return res.status(400).json({ error: "motive_url is required" })
  }

  const viewPosition = (body.view_position ?? "FRONT").toUpperCase()
  const motiveFilename = body.motive_filename ?? "design.png"

  // Fetch motive from file store → base64
  let motiveBase64: string
  try {
    const motiveResp = await fetch(motiveUrl)
    if (!motiveResp.ok) {
      return res
        .status(502)
        .json({ error: `Failed to fetch motive: HTTP ${motiveResp.status}` })
    }
    const motiveBuffer = Buffer.from(await motiveResp.arrayBuffer())
    motiveBase64 = motiveBuffer.toString("base64")
  } catch (err: any) {
    return res
      .status(502)
      .json({ error: `Failed to fetch motive: ${err.message}` })
  }

  // Generate composed preview via throw-away order
  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  try {
    const preview = await shirtplatform.generatePreviewViaOrder(
      spProductId,
      colorId,
      sizeId,
      viewPosition,
      motiveBase64,
      motiveFilename,
      body.position_left,
      body.position_right,
      body.position_top
    )

    const mimeType = preview.contentType || "image/png"
    const dataUrl = `data:${mimeType};base64,${preview.buffer.toString("base64")}`

    return res.status(200).json({ image_data_url: dataUrl })
  } catch (err: any) {
    return res.status(502).json({
      error: "Preview generation failed",
      message: err.message,
    })
  }
}
