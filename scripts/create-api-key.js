// Run: npx medusa exec scripts/create-api-key.js
const { MedusaModule } = require("@medusajs/modules-sdk")
const { Medusa } = require("@medusajs/medusa")

async function main() {
  const app = await Medusa.load()
  const apiKeyModule = app.resolve("api_key")
  const result = await apiKeyModule.create({
    title: "Storefront",
    type: "publishable",
  })
  console.log("PUBLISHABLE_KEY:" + result.token)
  process.exit(0)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})