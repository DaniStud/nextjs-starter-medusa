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
  sku: string
  assignedColor?: { id: number }
  assignedSize?: { id: number }
  // Some APIs embed color/size directly
  color?: ShirtplatformProductColor
  size?: ShirtplatformProductSize
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

    return response.json() as Promise<T>
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
    const data = await this.request<any>(
      `/accounts/${this.accountId}/shops/${this.shopId}/products/${productId}/sku`
    )
    const items = data?.pagedData?.productSku ?? []
    return Array.isArray(items) ? items : [items]
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

  async commitOrder(orderId: number): Promise<any> {
    return this.request(
      `/accounts/${this.accountId}/shops/${this.shopId}/orders/${orderId}/commitOrder`,
      { method: "PUT" }
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

  async registerWebhook(url: string, topic: string): Promise<ShirtplatformWebhookPayload> {
    return this.request<ShirtplatformWebhookPayload>(
      `/accounts/${this.accountId}/shops/${this.shopId}/webhooks`,
      {
        method: "POST",
        body: JSON.stringify({ url, topic }),
      }
    )
  }
}

export default ShirtplatformModuleService
