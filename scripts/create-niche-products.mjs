/**
 * create-niche-products.mjs
 *
 * End-to-end script that creates niche products in both Shirtplatform and Medusa:
 *
 *   1. Reads generated-matrix.json + design PNGs from assets/text-designs/
 *   2. Gets preview mockup images from Shirtplatform (temp order → CreatorSE → image → cancel)
 *   3. Creates products in Medusa via Admin API with SP metadata on each variant
 *
 * Prerequisites:
 *   - Design PNGs rendered:      npm run render:designs
 *   - Medusa backend running:    http://localhost:9000
 *   - Shirtplatform credentials in .env.local
 *   - Medusa admin credentials in .env.local
 *
 * Usage:  node --env-file=.env.local scripts/create-niche-products.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ── Config ───────────────────────────────────────────────────────────

// Shirtplatform
const SP_API_URL = process.env.SHIRTPLATFORM_API_URL || "https://api.shirtplatform.com/webservices/rest"
const SP_USERNAME = process.env.SHIRTPLATFORM_USERNAME
const SP_PASSWORD = process.env.SHIRTPLATFORM_PASSWORD
const SP_ACCOUNT = process.env.SHIRTPLATFORM_ACCOUNT_ID || "387"
const SP_SHOP = process.env.SHIRTPLATFORM_SHOP_ID || "1597"

// Shirtplatform product IDs — updated via --discover flag or manually
// Default: Stanley Stella Crafter T unisex Men (product 46881)
// These will be populated by the discover step or can be set manually
let SP_PRODUCT_ID = 46881
let SP_COLORS = { white: 302483, black: 302485 }
let SP_SIZES = { S: 171088, M: 171089, L: 171090, XL: 171091, XXL: 171092, "3XL": 171093 }
const SP_CARRIER_ID = 872
const SP_COUNTRY_ID = 4742 // Denmark

// Print positioning (mm) — for text designs centered on chest
const PRINT_POSITION = {
  left: "60",    // left margin in mm
  right: "60",   // right margin in mm
  top: "40",     // top margin in mm (from print area top)
}

// Medusa
const MEDUSA_URL = process.env.MEDUSA_ADMIN_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const MEDUSA_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD

// Price (EUR) — Medusa v2 uses whole currency units, not cents
const PRODUCT_PRICE = 34.99 // €34.99

// Delay between SP API calls to avoid throttling
const SP_DELAY_MS = 2000

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Shirtplatform Auth ───────────────────────────────────────────────

let spToken = null

async function getSpToken() {
  if (spToken) return spToken
  const cred = Buffer.from(`${SP_USERNAME}:${SP_PASSWORD}`).toString("base64")
  const res = await fetch(`${SP_API_URL}/auth`, {
    headers: { Authorization: `Basic ${cred}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`SP auth failed: ${res.status}`)
  spToken = res.headers.get("x-auth-token")
  return spToken
}

async function spRequest(endpoint, options = {}) {
  const token = await getSpToken()
  const res = await fetch(`${SP_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "x-auth-token": token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SP API ${res.status}: ${text.substring(0, 300)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Discover Product IDs ─────────────────────────────────────────────

async function discoverProduct(productId) {
  console.log(`\n🔍  Discovering Shirtplatform product ${productId}...\n`)
  const data = await spRequest(
    `/accounts/${SP_ACCOUNT}/shops/${SP_SHOP}/products/expanded/${productId}`
  )
  const product = data?.productExpanded ?? data

  // Extract colors
  const rawColors = product.assignedColors?.assignedProductColorExpanded ?? []
  const colors = Array.isArray(rawColors) ? rawColors : [rawColors]

  console.log("  Colors:")
  const colorMap = {}
  for (const c of colors) {
    const name = c.productColor?.name?.toLowerCase()
    const hexCode = c.productColor?.hexCode
    console.log(`    ${c.productColor?.name} (id: ${c.id}, hex: ${hexCode}, active: ${c.active})`)
    if (name?.includes("white")) colorMap.white = c.id
    if (name?.includes("black")) colorMap.black = c.id
  }

  // Extract sizes
  const rawSizes = product.assignedSizes?.assignedProductSizeExpanded ?? []
  const sizes = Array.isArray(rawSizes) ? rawSizes : [rawSizes]

  console.log("\n  Sizes:")
  const sizeMap = {}
  for (const s of sizes) {
    const name = s.productSize?.name
    console.log(`    ${name} (id: ${s.id})`)
    if (["S", "M", "L", "XL", "XXL", "3XL"].includes(name)) {
      sizeMap[name] = s.id
    }
  }

  if (!colorMap.white || !colorMap.black) {
    console.error("\n❌  Could not find white and black colors. Available:", colors.map(c => c.productColor?.name))
    process.exit(1)
  }
  if (Object.keys(sizeMap).length < 4) {
    console.error("\n❌  Not enough sizes found. Available:", sizes.map(s => s.productSize?.name))
    process.exit(1)
  }

  SP_COLORS = colorMap
  SP_SIZES = sizeMap

  console.log(`\n  ✅ White: ${SP_COLORS.white}, Black: ${SP_COLORS.black}`)
  console.log(`  ✅ Sizes: ${JSON.stringify(SP_SIZES)}\n`)

  // Save discovery results for reuse
  const discoveryPath = resolve(ROOT, "src/data/sp-product-discovery.json")
  writeFileSync(discoveryPath, JSON.stringify({
    productId: SP_PRODUCT_ID,
    colors: SP_COLORS,
    sizes: SP_SIZES,
    discoveredAt: new Date().toISOString(),
  }, null, 2), "utf-8")
  console.log(`  Saved to src/data/sp-product-discovery.json\n`)
}

// ── Generate Preview Image ───────────────────────────────────────────

async function generatePreview(comboId, base64Design, colorId, filename) {
  // 1. Create temp order
  const orderData = await spRequest(`/accounts/${SP_ACCOUNT}/shops/${SP_SHOP}/orders`, {
    method: "POST",
    body: JSON.stringify({
      productionOrder: {
        uniqueId: `preview-${comboId}-${Date.now()}`,
        financialStatus: "PAID",
        country: { id: SP_COUNTRY_ID },
        orderShipping: { title: "Standard Shipping", carrier: { id: SP_CARRIER_ID } },
        customer: {
          firstName: "Preview", lastName: "Bot", email: "preview@niche.bot",
          shippingAddress: { street: "Test", streetNo: "1", city: "Copenhagen", zip: "2200", countryCode: "DK" },
          billingAddress: { street: "Test", streetNo: "1", city: "Copenhagen", zip: "2200", countryCode: "DK" },
        },
      },
    }),
  })
  const orderId = orderData.productionOrderExpanded?.id ?? orderData.productionOrder?.id

  // 2. Add CreatorSE product with inline motive
  const sizeId = SP_SIZES.L || SP_SIZES.M || Object.values(SP_SIZES)[0]
  const addData = await spRequest(
    `/accounts/${SP_ACCOUNT}/shops/${SP_SHOP}/orders/${orderId}/orderedProducts/usingCreatorSE`,
    {
      method: "POST",
      body: JSON.stringify({
        creatorse_design: {
          productId: SP_PRODUCT_ID,
          amount: 1,
          assignedColor: { id: colorId },
          assignedSize: { id: sizeId },
          compositions: {
            creatorse_composition: [{
              productArea: {
                assignedView: { view: { position: "FRONT" } },
              },
              elements: [{
                creatorse_designElementMotive: {
                  motive: {
                    attachment: base64Design,
                    filename,
                  },
                  position: PRINT_POSITION,
                },
              }],
            }],
          },
        },
      }),
    }
  )
  const opId = addData.orderedProduct?.id

  // 3. Download preview image
  const token = await getSpToken()
  const imgRes = await fetch(
    `${SP_API_URL}/accounts/${SP_ACCOUNT}/shops/${SP_SHOP}/orders/${orderId}/orderedProducts/${opId}/image`,
    { headers: { "x-auth-token": token, Accept: "image/png" } }
  )
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

  // 4. Cancel the order (don't actually produce anything)
  await spRequest(
    `/accounts/${SP_ACCOUNT}/shops/${SP_SHOP}/orders/${orderId}/cancelOrder`,
    { method: "DELETE" }
  )

  return imgBuffer
}

// ── Medusa Admin API ─────────────────────────────────────────────────

let medusaToken = null

async function getMedusaToken() {
  if (medusaToken) return medusaToken
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Medusa auth failed: ${res.status} ${text.substring(0, 200)}`)
  }
  const data = await res.json()
  medusaToken = data.token
  return medusaToken
}

async function medusaRequest(endpoint, options = {}) {
  const token = await getMedusaToken()
  const res = await fetch(`${MEDUSA_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Medusa ${res.status}: ${text.substring(0, 300)}`)
  }
  return res.json()
}

async function uploadPreviewImage(imgBuffer, filename) {
  const token = await getMedusaToken()
  const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
    imgBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const res = await fetch(`${MEDUSA_URL}/admin/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed ${res.status}: ${text.substring(0, 200)}`)
  }

  const data = await res.json()
  return data.files[0].url
}

async function getExistingHandles() {
  const data = await medusaRequest("/admin/products?limit=200&fields=id,handle")
  return new Set(data.products.map((p) => p.handle))
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  if (!SP_USERNAME || !SP_PASSWORD) {
    console.error("❌  SHIRTPLATFORM_USERNAME and SHIRTPLATFORM_PASSWORD must be set in .env.local")
    process.exit(1)
  }
  if (!MEDUSA_EMAIL || !MEDUSA_PASSWORD) {
    console.error("❌  MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD must be set in .env.local")
    process.exit(1)
  }

  // 1. Load generated matrix
  const matrixPath = resolve(ROOT, "src/data/generated-matrix.json")
  if (!existsSync(matrixPath)) {
    console.error("❌  generated-matrix.json not found. Run `npm run generate:matrix` first.")
    process.exit(1)
  }
  const combos = JSON.parse(readFileSync(matrixPath, "utf-8"))
  console.log(`\n📦  Loaded ${combos.length} combos from generated-matrix.json`)

  // 2. Try loading cached SP discovery, otherwise discover
  const discoveryPath = resolve(ROOT, "src/data/sp-product-discovery.json")
  if (existsSync(discoveryPath)) {
    const cached = JSON.parse(readFileSync(discoveryPath, "utf-8"))
    SP_PRODUCT_ID = cached.productId
    SP_COLORS = cached.colors
    SP_SIZES = cached.sizes
    console.log(`  Using cached SP product ${SP_PRODUCT_ID} discovery`)
  } else {
    await discoverProduct(SP_PRODUCT_ID)
  }

  // 3. Ensure preview output directory
  const previewDir = resolve(ROOT, "assets/product-previews")
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true })

  // 4. Check which products already exist in Medusa
  console.log("\n🔗  Connecting to Medusa...")
  const existingHandles = await getExistingHandles()
  console.log(`  ${existingHandles.size} products already exist`)

  // 5. Process each combo
  const stats = { created: 0, skipped: 0, failed: 0 }
  const designDir = resolve(ROOT, "assets/text-designs")

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i]
    const { comboId, title, description, shirtText, bestKeyword, bestVolume } = combo

    console.log(`\n[${i + 1}/${combos.length}] ${title}`)

    // Skip if already exists
    if (existingHandles.has(comboId)) {
      console.log(`  ⏭ Already exists in Medusa, skipping`)
      stats.skipped++
      continue
    }

    // Check for design files
    const whiteDesignPath = resolve(designDir, `${comboId}-on-white.png`)
    const blackDesignPath = resolve(designDir, `${comboId}-on-black.png`)
    if (!existsSync(whiteDesignPath) || !existsSync(blackDesignPath)) {
      console.log(`  ⚠ Design PNGs not found, skipping. Run \`npm run render:designs\` first.`)
      stats.failed++
      continue
    }

    const whiteDesignB64 = readFileSync(whiteDesignPath).toString("base64")
    const blackDesignB64 = readFileSync(blackDesignPath).toString("base64")

    try {
      // 5a. Generate SP preview images (white shirt + black shirt)
      let whitePreviewUrl = null
      let blackPreviewUrl = null

      const whitePreviewPath = resolve(previewDir, `${comboId}-white.png`)
      const blackPreviewPath = resolve(previewDir, `${comboId}-black.png`)

      if (!existsSync(whitePreviewPath)) {
        console.log(`  📸 Generating white shirt preview...`)
        const whiteImg = await generatePreview(comboId, whiteDesignB64, SP_COLORS.white, `${comboId}-on-white.png`)
        writeFileSync(whitePreviewPath, whiteImg)
        await sleep(SP_DELAY_MS)
      } else {
        console.log(`  📸 White preview already cached`)
      }

      if (!existsSync(blackPreviewPath)) {
        console.log(`  📸 Generating black shirt preview...`)
        const blackImg = await generatePreview(comboId, blackDesignB64, SP_COLORS.black, `${comboId}-on-black.png`)
        writeFileSync(blackPreviewPath, blackImg)
        await sleep(SP_DELAY_MS)
      } else {
        console.log(`  📸 Black preview already cached`)
      }

      // 5b. Upload preview images to Medusa
      console.log(`  ⬆ Uploading previews to Medusa...`)
      const whiteImgBuf = readFileSync(whitePreviewPath)
      const blackImgBuf = readFileSync(blackPreviewPath)
      whitePreviewUrl = await uploadPreviewImage(whiteImgBuf, `${comboId}-white.png`)
      blackPreviewUrl = await uploadPreviewImage(blackImgBuf, `${comboId}-black.png`)

      // 5c. Build Medusa product
      const sizeNames = Object.keys(SP_SIZES)
      const variants = []

      // Build variant list for each color × size combo
      // NOTE: motive_attachment (base64) is NOT included here to keep the request small.
      // It's added in a separate update step after the product is created.
      const variantMetaMap = [] // { colorName, sizeName, designB64, designFilename }

      for (const [colorName, colorId] of Object.entries(SP_COLORS)) {
        const designB64 = colorName === "white" ? whiteDesignB64 : blackDesignB64
        const designFilename = `${comboId}-on-${colorName}.png`

        for (const [sizeName, sizeId] of Object.entries(SP_SIZES)) {
          const variantTitle = `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} / ${sizeName}`
          variants.push({
            title: variantTitle,
            sku: `NICHE-${comboId}-${colorName}-${sizeName}`.toUpperCase().slice(0, 100),
            options: {
              Color: colorName.charAt(0).toUpperCase() + colorName.slice(1),
              Size: sizeName,
            },
            prices: [{ amount: PRODUCT_PRICE, currency_code: "eur" }],
            metadata: {
              shirtplatform_product_id: SP_PRODUCT_ID,
              shirtplatform_assigned_color_id: colorId,
              shirtplatform_assigned_size_id: sizeId,
              shirtplatform_motive_filename: designFilename,
              shirtplatform_view_position: "FRONT",
              shirtplatform_position_left: PRINT_POSITION.left,
              shirtplatform_position_right: PRINT_POSITION.right,
              shirtplatform_position_top: PRINT_POSITION.top,
            },
          })
          variantMetaMap.push({ variantTitle, designB64, designFilename })
        }
      }

      const productPayload = {
        title,
        handle: comboId,
        description: description || undefined,
        status: "draft",
        images: [
          { url: whitePreviewUrl },
          { url: blackPreviewUrl },
        ],
        options: [
          { title: "Color", values: Object.keys(SP_COLORS).map(c => c.charAt(0).toUpperCase() + c.slice(1)) },
          { title: "Size", values: sizeNames },
        ],
        variants,
        metadata: {
          niche_combo_id: comboId,
          best_keyword: bestKeyword || null,
          best_volume: bestVolume || 0,
          shirt_text: shirtText || null,
        },
      }

      console.log(`  🛒 Creating Medusa product (${variants.length} variants)...`)
      const createRes = await medusaRequest("/admin/products", {
        method: "POST",
        body: JSON.stringify(productPayload),
      })

      // 5d. Update each variant with the base64 motive attachment separately
      const createdProduct = createRes.product
      console.log(`  🔗 Linking SP motive data to ${createdProduct.variants.length} variants...`)
      for (const createdVariant of createdProduct.variants) {
        const match = variantMetaMap.find(m => m.variantTitle === createdVariant.title)
        if (!match) {
          console.log(`    ⚠ No motive match for variant "${createdVariant.title}"`)
          continue
        }
        await medusaRequest(`/admin/products/${createdProduct.id}/variants/${createdVariant.id}`, {
          method: "POST",
          body: JSON.stringify({
            metadata: {
              ...createdVariant.metadata,
              shirtplatform_motive_attachment: match.designB64,
            },
          }),
        })
      }

      console.log(`  ✅ Created: ${title}`)
      stats.created++

    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`)
      stats.failed++
    }
  }

  console.log(`\n${"=".repeat(50)}`)
  console.log(`Done! Created: ${stats.created}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`)
  console.log(`Preview images: assets/product-previews/`)
  console.log(`\nNext steps:`)
  console.log(`  1. Check products in Medusa Admin (status: DRAFT)`)
  console.log(`  2. Review and publish products you want to go live`)
  console.log(`  3. Place a test order to verify SP forwarding\n`)
}

main().catch((err) => {
  console.error("💥  Script failed:", err)
  process.exit(1)
})
