import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/shirtplatform/motives
 *
 * Uploads a motive (design image) to the configured Medusa file store
 * (local/S3) and returns a publicly accessible URL. The admin product-builder
 * stores this URL in variant metadata as `shirtplatform_motive_url`; the
 * order-placed subscriber then passes it to Shirtplatform CreatorSE as
 * `motive.url` at fulfillment time.
 *
 * We accept base64 JSON rather than multipart so the route stays simple and
 * works with Medusa's default body parser. The admin widget will read the
 * picked file via FileReader → base64 → POST.
 *
 * Request body:
 *   {
 *     "filename": "dragon.png",
 *     "mime_type": "image/png",
 *     "content_base64": "iVBORw0KGgoAAAANSUh..."  // no data: prefix
 *   }
 *
 * Response:
 *   { "motive": { "url": "https://.../dragon.png", "key": "...", "filename": "dragon.png" } }
 */

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
])

// Hard cap matches typical motive sizes; tune if your designs are larger.
const MAX_BASE64_LENGTH = 25 * 1024 * 1024 // ~18 MB binary

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as {
    filename?: string
    mime_type?: string
    content_base64?: string
  }

  const filename = body.filename?.trim()
  const mimeType = body.mime_type?.trim()
  const contentBase64 = body.content_base64

  if (!filename || !mimeType || !contentBase64) {
    return res.status(400).json({
      error: "filename, mime_type and content_base64 are required",
    })
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return res.status(400).json({
      error: `Unsupported mime_type "${mimeType}". Allowed: ${[...ALLOWED_MIME].join(", ")}`,
    })
  }

  // Strip data: prefix if the caller forgot to.
  const cleanedBase64 = contentBase64.replace(/^data:[^;]+;base64,/, "")

  if (cleanedBase64.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({
      error: `Motive too large. Max base64 size: ${MAX_BASE64_LENGTH} chars.`,
    })
  }

  // Basic sanity check on the base64 payload.
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(cleanedBase64)) {
    return res.status(400).json({ error: "content_base64 is not valid base64" })
  }

  const fileModule = req.scope.resolve(Modules.FILE) as any

  try {
    const created = await fileModule.createFiles([
      {
        filename,
        mimeType,
        content: cleanedBase64,
      },
    ])
    const file = Array.isArray(created) ? created[0] : created
    return res.status(201).json({
      motive: {
        url: file?.url,
        key: file?.id ?? file?.key ?? null,
        filename,
        mime_type: mimeType,
      },
    })
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to upload motive to file store",
      message: err?.message ?? String(err),
    })
  }
}
