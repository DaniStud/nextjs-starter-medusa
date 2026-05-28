import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { SHIRTPLATFORM_MODULE } from "../../../../modules/shirtplatform"
import ShirtplatformModuleService from "../../../../modules/shirtplatform/service"

/**
 * POST /admin/shirtplatform/products
 *
 * Creates a Medusa product on top of a Shirtplatform base shirt template.
 *
 * The selected (color, size) combinations are filtered against the SP SKU
 * matrix so we never produce a variant that Shirtplatform can't actually
 * fulfill. Each variant carries the full SP coordinate set in metadata so the
 * order-placed subscriber can forward it without further lookup:
 *
 *   shirtplatform_product_id
 *   shirtplatform_assigned_color_id
 *   shirtplatform_assigned_size_id
 *   shirtplatform_motive_url
 *   shirtplatform_motive_filename
 *   shirtplatform_view_position
 *   shirtplatform_position_top|left|right
 *
 * Request body:
 *   {
 *     "sp_product_id": 46881,
 *     "color_ids": [12, 34],          // subset of base product's colors
 *     "size_ids": [3, 4, 5],          // subset of base product's sizes
 *     "motive": {
 *       "url": "https://.../dragon.png",
 *       "filename": "dragon.png",
 *       "view_position": "FRONT",
 *       "position_top": "100",        // millimetres, optional
 *       "position_left": "50",        // optional
 *       "position_right": "50"        // optional
 *     },
 *     "product": {
 *       "title": "Dragon Tee",
 *       "handle": "dragon-tee",       // optional, derived from title if omitted
 *       "description": "...",         // optional
 *       "status": "draft",            // "draft" | "published" (default: draft)
 *       "sales_channel_ids": ["sc_..."], // optional
 *       "collection_id": "pcol_...",     // optional
 *       "category_ids": ["pcat_..."]     // optional
 *     },
 *     "prices": [{ "amount": 2499, "currency_code": "eur" }]  // applied to every variant
 *   }
 *
 * Response: { product, skipped_combinations: [...] }
 */

type Body = {
  sp_product_id?: number
  color_ids?: number[]
  size_ids?: number[]
  motive?: {
    url?: string
    filename?: string
    view_position?: string
    position_top?: string
    position_left?: string
    position_right?: string
  }
  product?: {
    title?: string
    handle?: string
    description?: string
    status?: "draft" | "published"
    sales_channel_ids?: string[]
    collection_id?: string
    category_ids?: string[]
  }
  prices?: { amount: number; currency_code: string }[]
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Body

  // ---- validate -----------------------------------------------------------
  const spProductId = Number(body.sp_product_id)
  if (!Number.isFinite(spProductId) || spProductId <= 0) {
    return res.status(400).json({ error: "sp_product_id is required" })
  }

  const colorIds = (body.color_ids ?? []).map(Number).filter(Number.isFinite)
  const sizeIds = (body.size_ids ?? []).map(Number).filter(Number.isFinite)
  if (colorIds.length === 0 || sizeIds.length === 0) {
    return res
      .status(400)
      .json({ error: "color_ids and size_ids must each contain at least one id" })
  }

  const title = body.product?.title?.trim()
  if (!title) {
    return res.status(400).json({ error: "product.title is required" })
  }

  const prices = body.prices ?? []
  if (prices.length === 0) {
    return res
      .status(400)
      .json({ error: "prices must contain at least one { amount, currency_code }" })
  }

  // Motive is optional — without it the product is sold as a plain base shirt
  // (subscriber will use `usingBaseProduct` instead of CreatorSE).
  const motive = body.motive
  const hasMotive = Boolean(motive?.url)

  // ---- fetch SP base detail (cached) --------------------------------------
  const shirtplatform = req.scope.resolve<ShirtplatformModuleService>(
    SHIRTPLATFORM_MODULE
  )

  let detail
  try {
    detail = await shirtplatform.getBaseProductDetail(spProductId)
  } catch (err: any) {
    return res.status(502).json({
      error: "Failed to fetch Shirtplatform base product",
      message: err?.message ?? String(err),
    })
  }

  const colorById = new Map(detail.colors.map((c) => [c.id, c]))
  const sizeById = new Map(detail.sizes.map((s) => [s.id, s]))

  const unknownColors = colorIds.filter((id) => !colorById.has(id))
  const unknownSizes = sizeIds.filter((id) => !sizeById.has(id))
  if (unknownColors.length > 0 || unknownSizes.length > 0) {
    return res.status(400).json({
      error: "Selected color/size ids do not belong to this base product",
      unknown_color_ids: unknownColors,
      unknown_size_ids: unknownSizes,
    })
  }

  // ---- build variant list from valid SKU intersections --------------------
  const skuByPair = new Map(
    detail.skuMatrix.map((s) => [`${s.colorId}:${s.sizeId}`, s])
  )

  const variants: any[] = []
  const skippedCombinations: { color_id: number; size_id: number; reason: string }[] = []
  const colorNamesUsed = new Set<string>()
  const sizeNamesUsed = new Set<string>()

  const motiveMetadata: Record<string, string> = hasMotive
    ? {
        shirtplatform_motive_url: motive!.url!,
        ...(motive!.filename ? { shirtplatform_motive_filename: motive!.filename } : {}),
        shirtplatform_view_position: motive!.view_position ?? "FRONT",
        ...(motive!.position_top ? { shirtplatform_position_top: motive!.position_top } : {}),
        ...(motive!.position_left ? { shirtplatform_position_left: motive!.position_left } : {}),
        ...(motive!.position_right
          ? { shirtplatform_position_right: motive!.position_right }
          : {}),
      }
    : {}

  for (const colorId of colorIds) {
    for (const sizeId of sizeIds) {
      const skuEntry = skuByPair.get(`${colorId}:${sizeId}`)
      const color = colorById.get(colorId)!
      const size = sizeById.get(sizeId)!

      if (!skuEntry) {
        skippedCombinations.push({
          color_id: colorId,
          size_id: sizeId,
          reason: "no SKU on Shirtplatform for this color/size",
        })
        continue
      }

      colorNamesUsed.add(color.name)
      sizeNamesUsed.add(size.name)

      variants.push({
        title: `${color.name} / ${size.name}`,
        sku: "", // placeholder — replaced after handle is computed
        manage_inventory: false,
        options: { Color: color.name, Size: size.name },
        prices,
        metadata: {
          shirtplatform_product_id: spProductId,
          shirtplatform_assigned_color_id: colorId,
          shirtplatform_assigned_size_id: sizeId,
          ...motiveMetadata,
        },
      })
    }
  }

  if (variants.length === 0) {
    return res.status(400).json({
      error: "No selected color/size combination has a matching Shirtplatform SKU",
      skipped_combinations: skippedCombinations,
    })
  }

  // ---- assemble product input --------------------------------------------
  const handle =
    body.product?.handle?.trim() ??
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 255)

  // SKU must be globally unique. The same base shirt can be used for multiple
  // products (different motives/brands), so we include the handle in the SKU.
  // Format: SP-{handle}-{colorAssignmentId}-{sizeAssignmentId}
  for (const v of variants) {
    v.sku = `SP-${handle}-${v.metadata.shirtplatform_assigned_color_id}-${v.metadata.shirtplatform_assigned_size_id}`
  }

  const status =
    body.product?.status === "published" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT

  const productInput: any = {
    title,
    handle,
    description: body.product?.description,
    status,
    options: [
      { title: "Color", values: [...colorNamesUsed] },
      { title: "Size", values: [...sizeNamesUsed] },
    ],
    variants,
    metadata: {
      shirtplatform_product_id: spProductId,
      shirtplatform_base_product_name: detail.name,
      ...(hasMotive
        ? {
            shirtplatform_motive_url: motive!.url,
            shirtplatform_motive_filename: motive!.filename ?? null,
            shirtplatform_view_position: motive!.view_position ?? "FRONT",
          }
        : {}),
    },
  }

  if (body.product?.sales_channel_ids?.length) {
    productInput.sales_channels = body.product.sales_channel_ids.map((id) => ({ id }))
  }
  if (body.product?.collection_id) {
    productInput.collection_id = body.product.collection_id
  }
  if (body.product?.category_ids?.length) {
    productInput.category_ids = body.product.category_ids
  }

  // ---- create via core workflow ------------------------------------------
  try {
    const { result } = await createProductsWorkflow(req.scope).run({
      input: { products: [productInput] },
    })
    const product = Array.isArray(result) ? result[0] : result

    // ---- fetch preview images from Shirtplatform and attach as product images
    // For each selected color we fetch front+back images so every variant gets
    // its own per-color thumbnail. The first color's front image becomes the
    // product thumbnail. If a motive was uploaded, its raw image is added to
    // the product gallery too.
    try {
      const fileModule = req.scope.resolve(Modules.FILE) as any
      const productModule = req.scope.resolve(Modules.PRODUCT) as any
      const viewPosition = hasMotive ? (motive!.view_position ?? "FRONT") : "FRONT"

      // Determine which views need images (always both)
      const viewsToFetch: string[] = ["FRONT", "BACK"]
      // Views where the motive is placed
      const motiveViews: string[] = []
      if (hasMotive) {
        if (viewPosition === "FRONT" || viewPosition === "BOTH") motiveViews.push("FRONT")
        if (viewPosition === "BACK" || viewPosition === "BOTH") motiveViews.push("BACK")
      }

      const productImages: { url: string; rank: number }[] = []
      let thumbnailUrl: string | null = null
      // Map: colorId → front image URL (used as variant thumbnail)
      const variantThumbnailByColor = new Map<number, string>()
      let imageRank = 0

      // Add the raw motive image to the product gallery (so the design is
      // visible on the product page even if the composed preview fails)
      if (hasMotive && motive!.url) {
        productImages.push({ url: motive!.url, rank: imageRank++ })
      }

      // Fetch preview for each color
      for (const colorId of colorIds) {
        for (const vp of viewsToFetch) {
          const isMotiveView = motiveViews.includes(vp)
          let uploaded = false

          // Designed preview (motive on shirt) for motive views
          if (hasMotive && isMotiveView) {
            try {
              const preview = await shirtplatform.getDesignedProductPreview(
                spProductId,
                colorId,
                vp,
                motive!.url,
                undefined,
                motive!.position_left,
                motive!.position_right,
                motive!.position_top
              )
              const ext = preview.contentType.includes("svg") ? "svg" : "png"
              const filename = `sp-preview-${spProductId}-${colorId}-${vp.toLowerCase()}.${ext}`
              const created = await fileModule.createFiles([
                {
                  filename,
                  mimeType: preview.contentType,
                  content: preview.buffer.toString("base64"),
                  access: "public",
                },
              ])
              const file = Array.isArray(created) ? created[0] : created
              if (file?.url) {
                productImages.push({ url: file.url, rank: imageRank++ })
                if (!thumbnailUrl) thumbnailUrl = file.url
                if (vp === "FRONT" && !variantThumbnailByColor.has(colorId)) {
                  variantThumbnailByColor.set(colorId, file.url)
                }
                uploaded = true
              }
            } catch (previewErr: any) {
              console.warn(`[SP] designedProducts/preview failed for color ${colorId} ${vp}: ${previewErr.message}`)
            }
          }

          // Blank shirt fallback
          if (!uploaded) {
            const matchingView = detail.views.find(
              (v) => v.position.toUpperCase() === vp.toUpperCase()
            )
            try {
              let preview: { buffer: Buffer; contentType: string }
              if (matchingView) {
                preview = await shirtplatform.getProductViewColorImage(
                  spProductId,
                  matchingView.id,
                  colorId
                )
              } else {
                preview = await shirtplatform.getProductPreviewImage(spProductId)
              }
              const filename = `sp-blank-${spProductId}-${colorId}-${vp.toLowerCase()}.png`
              const created = await fileModule.createFiles([
                {
                  filename,
                  mimeType: preview.contentType,
                  content: preview.buffer.toString("base64"),
                  access: "public",
                },
              ])
              const file = Array.isArray(created) ? created[0] : created
              if (file?.url) {
                productImages.push({ url: file.url, rank: imageRank++ })
                if (!thumbnailUrl) thumbnailUrl = file.url
                if (vp === "FRONT" && !variantThumbnailByColor.has(colorId)) {
                  variantThumbnailByColor.set(colorId, file.url)
                }
              }
            } catch (imgErr: any) {
              console.warn(`[SP] Product image fetch failed for color ${colorId} ${vp}: ${imgErr.message}`)
            }
          }
        }
      }

      // Attach images to the product
      if (productImages.length > 0) {
        const updatedProduct = await productModule.updateProducts(product.id, {
          thumbnail: thumbnailUrl ?? productImages[0].url,
          images: productImages.map((img) => ({ url: img.url, rank: img.rank })),
        })
        Object.assign(product, updatedProduct)
      }

      // Set per-variant thumbnails (each color gets its own front image)
      const createdVariants = product.variants ?? []
      for (const variant of createdVariants) {
        const variantColorId = variant.metadata?.shirtplatform_assigned_color_id
        if (variantColorId && variantThumbnailByColor.has(Number(variantColorId))) {
          try {
            await productModule.updateProductVariants(variant.id, {
              thumbnail: variantThumbnailByColor.get(Number(variantColorId)),
            })
          } catch (varErr: any) {
            console.warn(`[SP] Failed to set variant thumbnail for ${variant.id}: ${varErr.message}`)
          }
        }
      }
    } catch (imgErr: any) {
      // Image fetching is best-effort — product is already created
      console.warn(`[SP] Failed to attach preview images: ${imgErr.message}`)
    }

    return res.status(201).json({
      product,
      skipped_combinations: skippedCombinations,
    })
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to create Medusa product",
      message: err?.message ?? String(err),
    })
  }
}
