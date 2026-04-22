import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import NewsletterModuleService from "../../../../modules/newsletter/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { name, email } = req.body as { name?: string; email?: string }

  if (!email) {
    res.status(400).json({ message: "Email is required." })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: "Invalid email address." })
    return
  }

  const newsletterService: NewsletterModuleService = req.scope.resolve("newsletter")

  // Check for existing subscription
  const [existing] = await newsletterService.listNewsletterSubscribers({
    email,
  })

  if (existing) {
    res.status(409).json({ message: "This email is already subscribed." })
    return
  }

  const subscriber = await newsletterService.createNewsletterSubscribers({
    name: name?.trim() || "",
    email: email.trim().toLowerCase(),
  })

  res.status(201).json({ subscriber })
}
