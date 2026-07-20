"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getCollectionByHandle } from "./collections"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags",
          ...queryParams,
        },
        headers,
        next: {
          ...next,
          revalidate: 60,
        },
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Fetches products belonging to a collection, looked up by its handle.
 * Returns an empty product list (and `collection: null`) when the
 * collection does not exist, so callers can fall back gracefully.
 */
export const listProductsByCollection = async ({
  handle,
  countryCode,
  regionId,
  limit = 6,
}: {
  handle: string
  countryCode?: string
  regionId?: string
  limit?: number
}): Promise<{
  products: HttpTypes.StoreProduct[]
  count: number
  collection: HttpTypes.StoreCollection | null
}> => {
  const collection = await getCollectionByHandle(handle).catch(() => null)

  if (!collection?.id) {
    return { products: [], count: 0, collection: null }
  }

  const {
    response: { products, count },
  } = await listProducts({
    countryCode,
    regionId,
    queryParams: {
      collection_id: [collection.id],
      limit,
    },
  })

  return { products, count, collection }
}

/**
 * Best-effort "best sellers" list. The Medusa Store API has no sales-count
 * sorting, so this resolves best sellers by merchandising signals, in order:
 *
 *  1. A collection with the handle "best-sellers" (curated in Medusa Admin)
 *  2. Products tagged "best-seller" / "bestseller" / "best seller"
 *
 * Returns an empty array when neither signal exists — callers decide the
 * fallback (the homepage falls back to a slice of the newest products).
 */
export const listBestSellers = async ({
  countryCode,
  regionId,
  limit = 6,
}: {
  countryCode?: string
  regionId?: string
  limit?: number
}): Promise<HttpTypes.StoreProduct[]> => {
  // 1) Curated "best-sellers" collection
  const { products: collectionProducts } = await listProductsByCollection({
    handle: "best-sellers",
    countryCode,
    regionId,
    limit,
  })

  if (collectionProducts.length > 0) {
    return collectionProducts
  }

  // 2) Tag-based lookup (tags are already included in listProducts fields)
  const {
    response: { products: pool },
  } = await listProducts({
    countryCode,
    regionId,
    queryParams: { limit: 100 },
  })

  const isBestSellerTag = (value?: string | null) =>
    !!value && /best[\s_-]?seller/i.test(value)

  const tagged = pool.filter((product) =>
    product.tags?.some((tag) => isBestSellerTag(tag.value))
  )

  return tagged.slice(0, limit)
}
