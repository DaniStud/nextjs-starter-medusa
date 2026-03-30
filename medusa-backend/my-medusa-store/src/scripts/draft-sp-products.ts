import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * One-time script: set all Shirtplatform-synced products to DRAFT status.
 * Run: npx medusa exec ./src/scripts/draft-sp-products.ts
 */
export default async function draftSpProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status"],
  })

  const spProducts = products.filter(
    (p: any) => p.handle?.startsWith("sp-") && p.status === "published"
  )

  logger.info(`Found ${spProducts.length} published Shirtplatform products to set to draft`)

  if (spProducts.length === 0) return

  // Update in batches of 20
  for (let i = 0; i < spProducts.length; i += 20) {
    const batch = spProducts.slice(i, i + 20)
    await updateProductsWorkflow(container).run({
      input: {
        products: batch.map((p: any) => ({ id: p.id, status: ProductStatus.DRAFT })),
      },
    })
    logger.info(`Updated batch ${Math.floor(i / 20) + 1} (${batch.length} products)`)
  }

  logger.info(`Done — ${spProducts.length} products set to draft`)
}
