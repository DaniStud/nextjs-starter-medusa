import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import type ShirtplatformModuleService from "../../../../modules/shirtplatform/service"
import * as fs from "fs"
import * as path from "path"

/**
 * POST /admin/sp-test/upload-motive
 *
 * Temporary route — creates a motive in Shirtplatform, uploads a PNG,
 * and assigns a print technology.
 *
 * Body (JSON):
 *   {
 *     "name": "10shirts logo",
 *     "filePath": "static/10shirts-logo.png",   // relative to medusa project root
 *     "printTechnologyId": 3                      // from GET /admin/sp-test?productId=xxx
 *   }
 *
 * If printTechnologyId is omitted, the motive is created + image uploaded
 * but no print tech is assigned (you can assign later).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sp = req.scope.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)
  const { name, filePath: relPath, printTechnologyId } = req.body as {
    name?: string
    filePath?: string
    printTechnologyId?: number
  }

  if (!name) {
    return res.status(400).json({ error: "name is required" })
  }

  try {
    // Step 1 — Create the motive record
    const createRes = await sp.request<any>(
      `/accounts/${sp.accountId}/shops/${sp.shopId}/motives`,
      {
        method: "POST",
        body: JSON.stringify({
          motive: { name, type: "HIGH_RESOLUTION_BITMAP" },
        }),
      }
    )

    const motiveId = createRes?.motive?.id ?? createRes?.id
    if (!motiveId) {
      return res.status(500).json({ error: "Failed to get motive ID from response", raw: createRes })
    }

    let uploadResult: any = null

    // Step 2 — Upload the bitmap if a file path was provided
    if (relPath) {
      const absPath = path.resolve(process.cwd(), relPath)

      if (!fs.existsSync(absPath)) {
        return res.status(400).json({
          error: `File not found: ${absPath}`,
          motiveId,
          hint: "Motive record was created but image was not uploaded.",
        })
      }

      const fileBuffer = fs.readFileSync(absPath)
      const fileName = path.basename(absPath)

      // Build multipart/form-data manually
      const boundary = `----FormBoundary${Date.now()}`
      const bodyParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
        `Content-Type: image/png\r\n\r\n`,
      ]

      const headerBuffer = Buffer.from(bodyParts.join(""), "utf-8")
      const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
      const multipartBody = Buffer.concat([headerBuffer, fileBuffer, footerBuffer])

      const token = await sp.getToken()

      const uploadRes = await fetch(
        `${(sp as any).apiUrl}/accounts/${sp.accountId}/shops/${sp.shopId}/motives/${motiveId}/bitmap`,
        {
          method: "POST",
          headers: {
            "x-auth-token": token,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      )

      if (!uploadRes.ok) {
        const errText = await uploadRes.text()
        return res.status(uploadRes.status).json({
          error: `Bitmap upload failed: ${errText}`,
          motiveId,
          hint: "Motive record was created but image upload failed.",
        })
      }

      uploadResult = await uploadRes.json().catch(() => ({ status: uploadRes.status }))
    }

    // Step 3 — Assign print technology if provided
    let printTechResult: any = null
    if (printTechnologyId) {
      printTechResult = await sp.request(
        `/accounts/${sp.accountId}/shops/${sp.shopId}/motives/${motiveId}/technologies`,
        {
          method: "POST",
          body: JSON.stringify({
            motivePrintTechnology: {
              printTechnology: { id: printTechnologyId },
            },
          }),
        }
      )
    }

    return res.json({
      success: true,
      motiveId,
      uploadResult,
      printTechResult,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
