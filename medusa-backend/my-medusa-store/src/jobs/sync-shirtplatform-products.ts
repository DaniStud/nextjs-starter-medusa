import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { SHIRTPLATFORM_MODULE } from "../modules/shirtplatform"
import ShirtplatformModuleService from "../modules/shirtplatform/service"

/**
 * Syncs all Shirtplatform products into the Medusa product catalog.
 *
 * Run manually:  npx medusa exec ./src/jobs/sync-shirtplatform-products.ts
 * Runs daily at: 02:00 server time
 */
export default async function syncShirtplatformProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const shirtplatform = container.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)

  logger.info("[SP Sync] Starting Shirtplatform product sync")

  // -----------------------------------------------------------------------
  // 1. Fetch all products (basic list, paginated)
  // -----------------------------------------------------------------------
  let spProducts: any[]
  try {
    spProducts = await shirtplatform.listAllProducts()
  } catch (err: any) {
    logger.error(`[SP Sync] Failed to fetch Shirtplatform products: ${err.message}`)
    return
  }

  logger.info(`[SP Sync] Fetched ${spProducts.length} products from Shirtplatform`)

  // -----------------------------------------------------------------------
  // 2. Load existing Medusa products to detect duplicates by handle
  // -----------------------------------------------------------------------
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingByHandle = new Map(existingProducts.map((p: any) => [p.handle, p.id]))

  const stats = { created: 0, skipped: 0, failed: 0 }

  for (const sp of spProducts) {
    if (sp.deleted || !sp.active) continue

    try {
      // ---------------------------------------------------------------
      // 3. Fetch expanded product (colors + sizes inlined)
      // ---------------------------------------------------------------
      const expanded = await shirtplatform.getProductExpanded(sp.id)

      // ---------------------------------------------------------------
      // 4. Fetch SKUs and prices as separate sub-resources
      // ---------------------------------------------------------------
      const skus = await shirtplatform.getProductSkus(sp.id)
      const prices = await shirtplatform.getProductPrices(sp.id)

      // ---------------------------------------------------------------
      // 5. Build Medusa product data
      // ---------------------------------------------------------------
      const productData = buildProductData(expanded, skus, prices)

      // ---------------------------------------------------------------
      // 6. Skip if already exists, otherwise create
      // ---------------------------------------------------------------
      if (existingByHandle.has(productData.handle)) {
        logger.info(`[SP Sync] Skipped ${sp.id} (${productData.title}) — already exists`)
        stats.skipped++
        continue
      }

      await createProductsWorkflow(container).run({
        input: { products: [productData] },
      })

      logger.info(`[SP Sync] Created ${sp.id} (${productData.title}) — ${productData.variants?.length ?? 0} variants`)
      stats.created++
    } catch (err: any) {
      logger.error(`[SP Sync] Failed to sync product ${sp.id} (${sp.name}): ${err.message}`)
      stats.failed++
    }
  }

  logger.info(
    `[SP Sync] Done — created: ${stats.created}, skipped: ${stats.skipped}, failed: ${stats.failed}`
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHandle(spProductId: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `sp-${spProductId}-${slug}`.slice(0, 255)
}

function buildProductData(sp: any, skus: any[], prices: any[]): any {
  // Resolve display name from localizations
  const localizations = sp.localizations?.productLocalized ?? sp.localizations ?? []
  const locArr = Array.isArray(localizations) ? localizations : [localizations]
  const enLocale = locArr.find((l: any) => l.language?.code === "en") ?? locArr[0]
  const title = enLocale?.name ?? sp.name ?? `Product ${sp.id}`
  const handle = toHandle(sp.id, title)
  const description = enLocale?.description ?? ""

  // Extract assigned colors and sizes from expanded product
  const rawColors = sp.assignedColors?.assignedProductColorExpanded ?? []
  const assignedColors: any[] = Array.isArray(rawColors) ? rawColors : [rawColors]
  const rawSizes = sp.assignedSizes?.assignedProductSizeExpanded ?? []
  const assignedSizes: any[] = Array.isArray(rawSizes) ? rawSizes : [rawSizes]

  const colorNames = [...new Set(assignedColors.map((ac: any) => ac.productColor?.name).filter(Boolean))]
  const sizeNames = [...new Set(assignedSizes.map((as_: any) => as_.productSize?.name).filter(Boolean))]

  // Build variants from SKUs (each SKU = one color × size intersection)
  const firstPrice = prices[0]?.price ?? 0
  const priceAmount = Math.round(firstPrice * 100) // euros → cents

  const variants: any[] = []
  for (const sku of skus) {
    const color = assignedColors.find((ac: any) => ac.id === sku.assignedColor?.id)
    const size = assignedSizes.find((as_: any) => as_.id === sku.assignedSize?.id)
    if (!color || !size) continue
    const colorName = color.productColor?.name ?? "Default"
    const sizeName = size.productSize?.name ?? "Default"
    variants.push({
      title: `${colorName} / ${sizeName}`,
      sku: sku.sku,
      options: { Color: colorName, Size: sizeName },
      prices: priceAmount > 0 ? [{ amount: priceAmount, currency_code: "eur" }] : [],
      metadata: {
        shirtplatform_product_id: sp.id,
        shirtplatform_assigned_color_id: color.id,
        shirtplatform_assigned_size_id: size.id,
      },
    })
  }

  // Fallback: if no SKUs, generate color × size cartesian product
  if (variants.length === 0 && assignedColors.length > 0 && assignedSizes.length > 0) {
    for (const color of assignedColors) {
      for (const size of assignedSizes) {
        const colorName = color.productColor?.name ?? "Default"
        const sizeName = size.productSize?.name ?? "Default"
        variants.push({
          title: `${colorName} / ${sizeName}`,
          sku: `SP-${sp.id}-${color.id}-${size.id}`,
          options: { Color: colorName, Size: sizeName },
          prices: priceAmount > 0 ? [{ amount: priceAmount, currency_code: "eur" }] : [],
          metadata: {
            shirtplatform_product_id: sp.id,
            shirtplatform_assigned_color_id: color.id,
            shirtplatform_assigned_size_id: size.id,
          },
        })
      }
    }
  }

  const options: any[] = []
  if (colorNames.length > 0) options.push({ title: "Color", values: colorNames })
  if (sizeNames.length > 0) options.push({ title: "Size", values: sizeNames })

  return {
    title,
    handle,
    description: description || undefined,
    status: ProductStatus.DRAFT,
    metadata: { shirtplatform_product_id: sp.id },
    options: options.length > 0 ? options : undefined,
    variants: variants.length > 0 ? variants : undefined,
  }
}

export const config = {
  name: "sync-shirtplatform-products",
  schedule: "0 2 * * *", // 2:00 AM daily
}
