import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * POST /admin/shirtplatform/register-webhook
 *
 * One-time admin action: registers a webhook subscription on Shirtplatform.
 *
 * Request body:
 *   { "url": "https://your-backend.com/store/shirtplatform-webhook", "topic": "orders/fulfilled" }
 *
 * Returns the created webhook record from Shirtplatform.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { url, topic } = req.body as { url?: string; topic?: string }

  if (!url || !topic) {
    return res.status(400).json({ error: "Both 'url' and 'topic' are required" })
  }

  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)

  const webhook = await shirtplatform.registerWebhook(url, topic)

  return res.status(200).json({ webhook })
}
