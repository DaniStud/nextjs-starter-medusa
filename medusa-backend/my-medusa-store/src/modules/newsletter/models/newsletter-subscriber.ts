import { model } from "@medusajs/framework/utils"

const NewsletterSubscriber = model.define("newsletter_subscriber", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
})

export default NewsletterSubscriber
