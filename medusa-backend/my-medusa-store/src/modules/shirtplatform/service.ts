import Redis from "ioredis"

// ---------------------------------------------------------------------------
// Redis client (same lazy-connect pattern as src/api/stripe/utils.ts)
// ---------------------------------------------------------------------------

const CACHE_KEY = "shirtplatform_auth_token"
const TOKEN_TTL_SECONDS = 60 * 60 * 12 // 12 hours

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    redis.connect().catch(() => {
      console.warn("[Shirtplatform] Redis connection failed, using in-memory token fallback")
      redis = null
    })
    return redis
  } catch {
    return null
  }
}

// In-memory fallback when Redis is unavailable
let memoryToken: string | null = null
let memoryTokenExpiry: number = 0

// ---------------------------------------------------------------------------
// Shirtplatform API Types
// ---------------------------------------------------------------------------

export interface ShirtplatformCountry {
  id: number
  code: string
  name: string
  currency?: { code: string }
}

export interface ShirtplatformProductColor {
  id: number
  name: string
  hexCode?: string
}

export interface ShirtplatformProductSize {
  id: number
  name: string
}

export interface ShirtplatformAssignedColor {
  id: number
  productColor: ShirtplatformProductColor
  default?: boolean
  active?: boolean
}

export interface ShirtplatformAssignedSize {
  id: number
  productSize: ShirtplatformProductSize
  default?: boolean
}

export interface ShirtplatformProductSku {
  id: number
  stockId?: number
  available?: boolean
  plu?: string
  assignedColor?: { id: number; productColor?: ShirtplatformProductColor }
  assignedSize?: { id: number; productSize?: ShirtplatformProductSize }
}

export interface ShirtplatformPrice {
  id: number
  price: number
  countryId?: number
}

export interface ShirtplatformProductLocalization {
  id: number
  name: string
  language?: { code: string }
}

export interface ShirtplatformProductExpanded {
  id: number
  name?: string
  localizations?: ShirtplatformProductLocalization[]
  assignedColors?: ShirtplatformAssignedColor[]
  assignedSizes?: ShirtplatformAssignedSize[]
  sku?: ShirtplatformProductSku[]
  prices?: ShirtplatformPrice[]
  active?: boolean
}

export interface ShirtplatformOrderPayload {
  uniqueId?: string
  financialStatus?: string
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    shippingAddress?: Record<string, any>
    billingAddress?: Record<string, any>
  }
  country?: { id: number }
  orderShipping?: Record<string, any>
  comment?: string
}

export interface ShirtplatformOrderResponse {
  id: number
  uniqueId?: string
}

export interface ShirtplatformWebhookPayload {
  id: number
  url: string
  topic: string
}

export interface ShirtplatformFulfillmentItem {
  id: number
  trackingNumber?: string
  trackingUrl?: string
  name?: string
}

// ---------------------------------------------------------------------------
// Admin-UI-friendly summary shapes
// (flattened from the raw SP API response, used by the admin product-builder)
// ---------------------------------------------------------------------------

export interface ShirtplatformBaseProductSummary {
  id: number
  name: string
  active: boolean
}

export interface ShirtplatformBaseProductDetail {
  id: number
  name: string
  description?: string
  active: boolean
  colors: { id: number; name: string; hexCode?: string }[]
  sizes: { id: number; name: string }[]
  /** Only colors that appear in at least one SKU (i.e. actually orderable) */
  availableColorIds: number[]
  /** Only sizes that appear in at least one SKU */
  availableSizeIds: number[]
  /** Each entry = an available (color, size) combination produced by SP.
   *  `spSkuId` is the Shirtplatform ProductSku record ID.
   *  `stockId` is the underlying stock-item ID.
   *  `sku` is a synthetic string for use as Medusa variant.sku. */
  skuMatrix: { colorId: number; sizeId: number; spSkuId: number; stockId: number; sku: string }[]
  /** Views available on this product (FRONT, BACK, etc.) with their SP IDs */
  views: { id: number; position: string; defaultView: boolean }[]
  /** SP production base price in EUR (informational; retail price set in Medusa) */
  basePriceEur: number
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ShirtplatformModuleService {
  readonly apiUrl: string
  private readonly username: string
  private readonly password: string
  readonly accountId: string
  readonly shopId: string

  constructor() {
    this.apiUrl = process.env.SHIRTPLATFORM_API_URL || ""
    this.username = process.env.SHIRTPLATFORM_USERNAME || ""
    this.password = process.env.SHIRTPLATFORM_PASSWORD || ""
    this.accountId = process.env.SHIRTPLATFORM_ACCOUNT_ID || ""
    this.shopId = process.env.SHIRTPLATFORM_SHOP_ID || ""
  }

  // -------------------------------------------------------------------------
  // Auth / Token Management
  // -------------------------------------------------------------------------

  async getToken(): Promise<string> {
    const client = getRedis()

    // 1. Try Redis cache
    if (client) {
      try {
        const cached = await client.get(CACHE_KEY)
        if (cached) return cached
      } catch {
        // fall through to memory fallback
      }
    }

    // 2. Try in-memory cache
    if (memoryToken && Date.now() < memoryTokenExpiry) {
      return memoryToken
    }

    // 3. Authenticate
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString("base64")

    const response = await fetch(`${this.apiUrl}/auth`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Shirtplatform auth failed: ${response.status} ${response.statusText}`)
    }

    const token = response.headers.get("x-auth-token")
    if (!token) {
      throw new Error("Shirtplatform API did not return an x-auth-token header")
    }

    // 4. Store in Redis with TTL
    if (client) {
      try {
        await client.set(CACHE_KEY, token, "EX", TOKEN_TTL_SECONDS)
      } catch {
        // fall through to memory
      }
    }

    // 5. Always store in memory as fallback
    memoryToken = token
    memoryTokenExpiry = Date.now() + TOKEN_TTL_SECONDS * 1000

    return token
  }

  private async invalidateToken(): Promise<void> {
    memoryToken = null
    memoryTokenExpiry = 0
    const client = getRedis()
    if (client) {
      try {
        await client.del(CACHE_KEY)
      } catch {
        // ignore
      }
    }
  }

  // -------------------------------------------------------------------------
  // HTTP request wrapper
  // -------------------------------------------------------------------------

  async request<T = any>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const token = await this.getToken()

    const headers: Record<string, string> = {
      "x-auth-token": token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (response.status === 401 && !isRetry) {
      await this.invalidateToken()
      return this.request<T>(endpoint, options, true)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shirtplatform API error (${response.status}): ${errorText}`)
    }

    // Some SP endpoints return empty bodies (e.g. commitOrder, cancelOrder)
    const text = await response.text()
    if (!text) return undefined as T

    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  /**
   * Fetch a binary resource (image) from the SP API.
   * Returns the raw Buffer and content-type.
   */
  async requestBinary(
    endpoint: string,
    isRetry = false
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const token = await this.getToken()

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "x-auth-token": token,
        Accept: "image/png, image/jpeg, image/svg+xml, */*",
      },
    })

    if (response.status === 401 && !isRetry) {
      await this.invalidateToken()
      return this.requestBinary(endpoint, true)
    }

    if (!response.ok) {
      throw new Error(`Shirtplatform image API error (${response.status})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") ?? "image/png"
    return { buffer: Buffer.from(arrayBuffer), contentType }
  }

  // -------------------------------------------------------------------------
  // Product API
  //
  // Response shapes (wrapRootValue=true):
  //   List:     { pagedData: { product: [...], totalElements: N, atom.link: ... } }
  //   Expanded: { productExpanded: { ..., assignedColors: { assignedProductColorExpanded: [...] }, ... } }
  //   SKUs:     { pagedData: { productSku: [...] } }
  //   Prices:   { pagedData: { productPricePrime: [...] } }
  // -------------------------------------------------------------------------

  /**
   * Fetch ALL products (non-expanded) across all pages.
   */
  async listAllProducts(): Promise<any[]> {
    const PAGE_SIZE = 100
    let page = 0
    const all: any[] = []

    while (true) {
      const data = await this.request<any>(
        `/accounts/${this.accountId}/shops/${this.shopId}/products?page=${page}&size=${PAGE_SIZE}`
      )
      const items = data?.pagedData?.product ?? []
      const arr = Array.isArray(items) ? items : [items]
      all.push(...arr)

      const total = data?.pagedData?.totalElements ?? 0
      if (all.length >= total || arr.length < PAGE_SIZE) break
      page++
    }

    return all
  }

  /**
   * Fetch a single expanded product (colors, sizes, views inlined).
   */
  async getProductExpanded(productId: number): Promise<ShirtplatformProductExpanded> {
    const data = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/products/expanded/${productId}`
    )
    return data?.productExpanded ?? data
  }

  /**
   * Fetch SKUs for a product.
   */
  async getProductSkus(productId: number): Promise<ShirtplatformProductSku[]> {
    const PAGE_SIZE = 100
    let page = 0
    const all: ShirtplatformProductSku[] = []
    while (true) {
      const data = await this.request<any>(
        `/accounts/${this.accountId}/shops/${this.shopId}/products/${productId}/sku?page=${page}&size=${PAGE_SIZE}`
      )
      const items = data?.pagedData?.productSku ?? []
      const arr: any[] = Array.isArray(items) ? items : [items]
      all.push(...arr)
      const total = data?.pagedData?.totalElements ?? 0
      if (all.length >= total || arr.length < PAGE_SIZE) break
      page++
    }
    return all
  }

  /**
   * Fetch prices for a product.
   */
  async getProductPrices(productId: number): Promise<ShirtplatformPrice[]> {
    const data = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/products/${productId}/prices`
    )
    const items = data?.pagedData?.productPricePrime ?? []
    return Array.isArray(items) ? items : [items]
  }

  // -------------------------------------------------------------------------
  // Country API
  // -------------------------------------------------------------------------

  async getCountries(): Promise<ShirtplatformCountry[]> {
    const data = await this.request<any>(`/accounts/${this.accountId}/countries`)
    if (Array.isArray(data)) return data
    const items = data?.pagedData?.country ?? data?.list ?? data?.data ?? data?.countries ?? []
    return Array.isArray(items) ? items : [items]
  }

  // -------------------------------------------------------------------------
  // Product Preview Images
  //
  // GET .../products/{id}/image
  //   → default preview (default view + default color)
  //
  // GET .../products/{id}/assignedViews/{viewId}/assignedColors/{colorId}/image
  //   → specific view + color preview
  // -------------------------------------------------------------------------

  /**
   * Fetch the default product preview image (default view + default color).
   */
  async getProductPreviewImage(productId: number): Promise<{ buffer: Buffer; contentType: string }> {
    return this.requestBinary(
      `/accounts/${this.accountId}/shops/${this.shopId}/products/${productId}/image`
    )
  }

  /**
   * Fetch a rendered preview image for a specific view + color combination.
   */
  async getProductViewColorImage(
    productId: number,
    assignedViewId: number,
    assignedColorId: number
  ): Promise<{ buffer: Buffer; contentType: string }> {
    return this.requestBinary(
      `/accounts/${this.accountId}/shops/${this.shopId}/products/${productId}/assignedViews/${assignedViewId}/assignedColors/${assignedColorId}/image`
    )
  }

  // -------------------------------------------------------------------------
  // Motive API — upload designs to Shirtplatform
  //
  // Step 1: POST .../motives  → create motive record → returns motive ID
  // Step 2: POST .../motives/{id}/bitmap  → upload image file
  // -------------------------------------------------------------------------

  /**
   * Create a motive record on Shirtplatform and return its ID.
   */
  async createSpMotive(name: string): Promise<number> {
    const data = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/motives`,
      {
        method: "POST",
        body: JSON.stringify({
          motive: {
            name,
            type: "HIGH_RESOLUTION_BITMAP",
          },
        }),
      }
    )
    const motive = data?.motive ?? data
    if (!motive?.id) {
      throw new Error("Shirtplatform did not return a motive ID")
    }
    return motive.id
  }

  /**
   * Upload a bitmap image to an existing Shirtplatform motive.
   * Uses multipart/form-data as required by the SP API.
   */
  async uploadSpMotiveBitmap(
    motiveId: number,
    imageBuffer: Buffer,
    filename: string
  ): Promise<void> {
    const token = await this.getToken()

    const formData = new FormData()
    const ab = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength
    ) as ArrayBuffer
    formData.append("file", new Blob([ab]), filename)

    const response = await fetch(
      `${this.apiUrl}/accounts/${this.accountId}/shops/${this.shopId}/motives/${motiveId}/bitmap`,
      {
        method: "POST",
        headers: {
          "x-auth-token": token,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      throw new Error(
        `Shirtplatform motive bitmap upload failed (${response.status}): ${errText}`
      )
    }
  }

  /**
   * Fetch the SVG preview of a designed product (motive placed on shirt).
   * POST .../designedProducts/preview with a CreatorSE-like body.
   */
  async getDesignedProductPreview(
    productId: number,
    assignedColorId: number,
    viewPosition: string,
    motiveUrl?: string,
    motiveId?: number,
    positionLeft?: string,
    positionRight?: string,
    positionTop?: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const motive: Record<string, any> = {}
    if (motiveUrl) {
      motive.url = motiveUrl
    } else if (motiveId) {
      motive.id = motiveId
    }

    const position: Record<string, string> =
      positionLeft && positionRight
        ? {
            left: positionLeft,
            right: positionRight,
            ...(positionTop ? { top: positionTop } : {}),
          }
        : { horizontalCenter: "0", verticalCenter: "0" }

    const token = await this.getToken()
    const body = {
      creatorse_design: {
        productId,
        assignedColor: { id: assignedColorId },
        compositions: {
          creatorse_composition: [
            {
              productArea: {
                assignedView: { view: { position: viewPosition } },
              },
              elements: [
                {
                  creatorse_designElementMotive: { motive, position },
                },
              ],
            },
          ],
        },
      },
    }

    const response = await fetch(
      `${this.apiUrl}/accounts/${this.accountId}/shops/${this.shopId}/designedProducts/preview`,
      {
        method: "POST",
        headers: {
          "x-auth-token": token,
          Accept: "image/png, image/svg+xml, */*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      throw new Error(`Shirtplatform designedProducts/preview error (${response.status})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") ?? "image/svg+xml"
    return { buffer: Buffer.from(arrayBuffer), contentType }
  }

  /**
   * Generate a high-quality composed preview (motive on shirt) using the
   * throw-away order approach. This is the most reliable method:
   *
   *  1. Create a temporary order
   *  2. Add a product with the design (motive sent inline as base64)
   *  3. GET the rendered image (SP composites motive onto shirt photo)
   *  4. Cancel the order so it's never fulfilled
   *
   * The motive is sent as `attachment` (base64) so SP doesn't need to fetch
   * any external URL.
   */
  async generatePreviewViaOrder(
    productId: number,
    assignedColorId: number,
    assignedSizeId: number,
    viewPosition: string,
    motiveBase64: string,
    motiveFilename: string,
    positionLeft?: string,
    positionRight?: string,
    positionTop?: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const uniqueId = `preview-${productId}-${assignedColorId}-${Date.now()}`

    // 1. Create throw-away order
    const orderData = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders`,
      {
        method: "POST",
        body: JSON.stringify({
          productionOrder: {
            uniqueId,
            financialStatus: "PAID",
            country: { id: 4742 },
            orderShipping: { title: "Preview", carrier: { id: 872 } },
            customer: {
              firstName: "Preview",
              lastName: "Bot",
              email: "preview@internal.local",
              shippingAddress: {
                street: "N/A", streetNo: "1",
                city: "Copenhagen", zip: "2200", countryCode: "DK",
              },
              billingAddress: {
                street: "N/A", streetNo: "1",
                city: "Copenhagen", zip: "2200", countryCode: "DK",
              },
            },
          },
        }),
      }
    )
    const orderId =
      orderData?.productionOrderExpanded?.id ?? orderData?.productionOrder?.id
    if (!orderId) {
      throw new Error("Failed to create throw-away order for preview")
    }

    try {
      // 2. Add product with inline motive (base64 attachment)
      const position: Record<string, string> =
        positionLeft && positionRight
          ? {
              left: positionLeft,
              right: positionRight,
              ...(positionTop ? { top: positionTop } : {}),
            }
          : { horizontalCenter: "0", verticalCenter: "0" }

      const designBody = {
        creatorse_design: {
          productId,
          amount: 1,
          assignedColor: { id: assignedColorId },
          assignedSize: { id: assignedSizeId },
          compositions: {
            creatorse_composition: [
              {
                productArea: {
                  assignedView: { view: { position: viewPosition } },
                },
                elements: [
                  {
                    creatorse_designElementMotive: {
                      motive: {
                        attachment: motiveBase64,
                        filename: motiveFilename,
                      },
                      position,
                    },
                  },
                ],
              },
            ],
          },
        },
      }

      const addData = await this.request<any>(
        `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/orderedProducts/usingCreatorSE`,
        { method: "POST", body: JSON.stringify(designBody) }
      )
      const opId = addData?.orderedProduct?.id
      if (!opId) {
        throw new Error("Failed to add ordered product for preview")
      }

      // 3. Download the rendered image
      return await this.requestBinary(
        `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/orderedProducts/${opId}/image`
      )
    } finally {
      // 4. Always cancel the order
      try {
        await this.request(
          `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/cancelOrder`,
          { method: "DELETE" }
        )
      } catch {
        // Ignore cancel errors
      }
    }
  }

  // -------------------------------------------------------------------------
  // Order API
  // -------------------------------------------------------------------------

  async createOrder(payload: ShirtplatformOrderPayload): Promise<ShirtplatformOrderResponse> {
    const data = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders`,
      {
        method: "POST",
        body: JSON.stringify({ productionOrder: payload }),
      }
    )
    // Response wraps in productionOrderExpanded or productionOrder
    const order = data?.productionOrderExpanded ?? data?.productionOrder ?? data
    return { id: order.id, uniqueId: order.uniqueId }
  }

  /**
   * Add a pre-designed product to an order using its base product ID.
   * Uses `usingBaseProduct/{productId}` — no customer customization (no CreatorSE).
   */
  async addOrderedProduct(
    orderId: number,
    productId: number,
    assignedColorId: number,
    assignedSizeId: number,
    amount: number
  ): Promise<any> {
    return this.request(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/orderedProducts/usingBaseProduct/${productId}`,
      {
        method: "POST",
        body: JSON.stringify({
          assignedProductColor: { id: assignedColorId },
          assignedProductSize: { id: assignedSizeId },
          amount,
        }),
      }
    )
  }

  /**
   * Add a product to an order using CreatorSE (dynamic design placement).
   * Supports either a motive ID reference or inline base64 attachment.
   */
  async addOrderedProductUsingCreatorSE(
    orderId: number,
    options: {
      productId: number
      assignedColorId: number
      assignedSizeId: number
      amount: number
      motiveId?: number
      motiveAttachment?: string // base64-encoded image
      motiveUrl?: string // publicly accessible URL to the design image
      motiveFilename?: string
      viewPosition?: string // e.g. "FRONT", "BACK" — defaults to "FRONT"
      positionLeft?: string // left margin in mm (controls width with positionRight)
      positionRight?: string // right margin in mm
      positionTop?: string // top margin in mm
    }
  ): Promise<any> {
    const {
      productId,
      assignedColorId,
      assignedSizeId,
      amount,
      motiveId,
      motiveAttachment,
      motiveUrl,
      motiveFilename,
      viewPosition = "FRONT",
      positionLeft,
      positionRight,
      positionTop,
    } = options

    // Build the motive reference: inline attachment, URL, or ID
    const motive: Record<string, any> = {}
    if (motiveAttachment) {
      motive.attachment = motiveAttachment
      if (motiveFilename) motive.filename = motiveFilename
    } else if (motiveUrl) {
      motive.url = motiveUrl
      if (motiveFilename) motive.filename = motiveFilename
    } else if (motiveId) {
      motive.id = motiveId
    }

    // Build position: use left/right/top if provided, otherwise center
    const position: Record<string, string> =
      positionLeft && positionRight
        ? {
            left: positionLeft,
            right: positionRight,
            ...(positionTop ? { top: positionTop } : {}),
          }
        : { horizontalCenter: "0", verticalCenter: "0" }

    const payload = {
      creatorse_design: {
        productId,
        amount,
        assignedColor: { id: assignedColorId },
        assignedSize: { id: assignedSizeId },
        compositions: {
          creatorse_composition: [
            {
              productArea: {
                assignedView: {
                  view: { position: viewPosition },
                },
              },
              elements: [
                {
                  creatorse_designElementMotive: {
                    motive,
                    position,
                  },
                },
              ],
            },
          ],
        },
      },
    }

    return this.request(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/orderedProducts/usingCreatorSE`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )
  }

  async commitOrder(orderId: number, financialStatus = "PAID"): Promise<any> {
    return this.request(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/commitOrder`,
      {
        method: "PUT",
        body: JSON.stringify({ financialStatus }),
      }
    )
  }

  async cancelOrder(orderId: number): Promise<any> {
    return this.request(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/cancelOrder`,
      { method: "DELETE" }
    )
  }

  // -------------------------------------------------------------------------
  // Webhook API
  // -------------------------------------------------------------------------

  async registerWebhook(
    address: string,
    topic: string,
    secret?: string
  ): Promise<ShirtplatformWebhookPayload> {
    const webhook: Record<string, string> = { address, topic, mediaType: "JSON" }
    if (secret) webhook.secret = secret

    return this.request<ShirtplatformWebhookPayload>(
      `/accounts/${this.accountId}/shops/${this.shopId}/webhooks`,
      {
        method: "POST",
        body: JSON.stringify({ webhook }),
      }
    )
  }

  // -------------------------------------------------------------------------
  // Admin product-builder helpers
  //
  // The admin UI needs:
  //   1. A fast list of base products to pick from   → getBaseProductSummaries()
  //   2. The colors/sizes/SKUs for a chosen product  → getBaseProductDetail(id)
  //
  // Both are cached in Redis (1h) since the SP catalog rarely changes day-to-day
  // and the admin will hit these endpoints many times while building a product.
  // -------------------------------------------------------------------------

  private static readonly CATALOG_SUMMARIES_KEY = "shirtplatform_base_summaries"
  private static readonly CATALOG_DETAIL_KEY_PREFIX = "shirtplatform_base_detail:"
  private static readonly CATALOG_TTL_SECONDS = 60 * 60 // 1 hour

  async getBaseProductSummaries(
    forceRefresh = false
  ): Promise<ShirtplatformBaseProductSummary[]> {
    const client = getRedis()
    const key = ShirtplatformModuleService.CATALOG_SUMMARIES_KEY

    if (!forceRefresh && client) {
      try {
        const cached = await client.get(key)
        if (cached) return JSON.parse(cached)
      } catch {
        // fall through to live fetch
      }
    }

    const raw = await this.listAllProducts()
    const summaries: ShirtplatformBaseProductSummary[] = raw
      .filter((p: any) => !p.deleted && p.active !== false)
      .map((p: any) => ({
        id: p.id,
        name: p.name ?? `Product ${p.id}`,
        active: p.active !== false,
      }))

    if (client) {
      try {
        await client.set(
          key,
          JSON.stringify(summaries),
          "EX",
          ShirtplatformModuleService.CATALOG_TTL_SECONDS
        )
      } catch {
        // best-effort cache
      }
    }
    return summaries
  }

  async getBaseProductDetail(
    productId: number,
    forceRefresh = false
  ): Promise<ShirtplatformBaseProductDetail> {
    const client = getRedis()
    const key = `${ShirtplatformModuleService.CATALOG_DETAIL_KEY_PREFIX}${productId}`

    if (!forceRefresh && client) {
      try {
        const cached = await client.get(key)
        if (cached) return JSON.parse(cached)
      } catch {
        // fall through
      }
    }

    const [expanded, skus, prices] = await Promise.all([
      this.getProductExpanded(productId),
      this.getProductSkus(productId),
      this.getProductPrices(productId),
    ])

    const detail = buildBaseProductDetail(expanded, skus, prices)

    if (client) {
      try {
        await client.set(
          key,
          JSON.stringify(detail),
          "EX",
          ShirtplatformModuleService.CATALOG_TTL_SECONDS
        )
      } catch {
        // best-effort cache
      }
    }
    return detail
  }

  /**
   * Drop all cached catalog entries. Call after a manual sync, or when the
   * admin clicks "Refresh from Shirtplatform".
   */
  async invalidateCatalogCache(): Promise<void> {
    const client = getRedis()
    if (!client) return
    try {
      const keys = await client.keys(
        `${ShirtplatformModuleService.CATALOG_DETAIL_KEY_PREFIX}*`
      )
      if (keys.length > 0) await client.del(...keys)
      await client.del(ShirtplatformModuleService.CATALOG_SUMMARIES_KEY)
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no service state) — exported for testing
// ---------------------------------------------------------------------------

export function buildBaseProductDetail(
  expanded: any,
  skus: any[],
  prices: any[]
): ShirtplatformBaseProductDetail {
  const localizations =
    expanded.localizations?.productLocalized ?? expanded.localizations ?? []
  const locArr = Array.isArray(localizations) ? localizations : [localizations]
  const enLocale =
    locArr.find((l: any) => l?.language?.code === "en") ?? locArr[0]
  const name = enLocale?.name ?? expanded.name ?? `Product ${expanded.id}`
  const description = enLocale?.description ?? undefined

  const rawColors =
    expanded.assignedColors?.assignedProductColorExpanded ?? []
  const assignedColors: any[] = Array.isArray(rawColors) ? rawColors : [rawColors]
  const rawSizes = expanded.assignedSizes?.assignedProductSizeExpanded ?? []
  const assignedSizes: any[] = Array.isArray(rawSizes) ? rawSizes : [rawSizes]

  const colors = assignedColors
    .filter((ac) => ac?.productColor)
    .map((ac) => ({
      id: ac.id as number,
      name: (ac.productColor.name as string) ?? `Color ${ac.id}`,
      hexCode: ac.productColor.hexCode as string | undefined,
    }))

  const sizes = assignedSizes
    .filter((as_) => as_?.productSize)
    .map((as_) => ({
      id: as_.id as number,
      name: (as_.productSize.name as string) ?? `Size ${as_.id}`,
    }))

  const skuMatrix = skus
    .filter((s) => s?.assignedColor?.id && s?.assignedSize?.id)
    .map((s) => ({
      colorId: s.assignedColor.id as number,
      sizeId: s.assignedSize.id as number,
      spSkuId: s.id as number,
      stockId: (s.stockId ?? s.id) as number,
      // Synthetic SKU for Medusa: SP-{productId}-{colorAssignmentId}-{sizeAssignmentId}
      sku: `SP-${expanded.id}-${s.assignedColor.id}-${s.assignedSize.id}`,
    }))

  // Derive which colors and sizes actually appear in at least one SKU.
  // The expanded product can list colors/sizes that have no SKU intersection
  // (e.g. a color discontinued for certain sizes). The wizard should only
  // offer selectable options — never show impossible variants.
  const availableColorIds = [...new Set(skuMatrix.map((s) => s.colorId))]
  const availableSizeIds = [...new Set(skuMatrix.map((s) => s.sizeId))]

  // Extract views from expanded product
  const rawViews =
    expanded.assignedViews?.assignedProductViewExpanded ?? []
  const viewsArr: any[] = Array.isArray(rawViews) ? rawViews : [rawViews]
  const views = viewsArr
    .filter((v) => v?.id)
    .map((v) => ({
      id: v.id as number,
      position: (v.productView?.position ?? v.view?.position ?? "FRONT") as string,
      defaultView: Boolean(v.defaultView),
    }))

  const basePriceEur = Number(prices?.[0]?.price ?? 0)

  return {
    id: expanded.id,
    name,
    description,
    active: expanded.active !== false,
    colors,
    sizes,
    availableColorIds,
    availableSizeIds,
    skuMatrix,
    views,
    basePriceEur,
  }
}

export default ShirtplatformModuleService
