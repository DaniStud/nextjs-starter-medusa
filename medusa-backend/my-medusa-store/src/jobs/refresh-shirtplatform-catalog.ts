import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SHIRTPLATFORM_MODULE } from "../modules/shirtplatform"
import ShirtplatformModuleService from "../modules/shirtplatform/service"

/**
 * Refreshes the cached Shirtplatform base-catalog summaries used by the admin
 * product-builder (GET /admin/shirtplatform/base-products).
 *
 * This job does NOT create or mirror Medusa products anymore. Medusa is the
 * source of truth for sellable products; admins build them via
 * POST /admin/shirtplatform/products on top of a chosen SP base shirt.
 *
 * Run manually:  npx medusa exec ./src/jobs/refresh-shirtplatform-catalog.ts
 * Runs daily at: 02:00 server time
 */
export default async function refreshShirtplatformCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const shirtplatform = container.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)

  logger.info("[SP Catalog] Refreshing Shirtplatform base-catalog cache")

  try {
    await shirtplatform.invalidateCatalogCache()
    const summaries = await shirtplatform.getBaseProductSummaries(true)
    logger.info(
      `[SP Catalog] Cached ${summaries.length} base products. Per-product detail is fetched on demand.`
    )
  } catch (err: any) {
    logger.error(`[SP Catalog] Failed to refresh: ${err.message}`)
  }
}

export const config = {
  name: "refresh-shirtplatform-catalog",
  schedule: "0 2 * * *", // 2:00 AM daily
}
