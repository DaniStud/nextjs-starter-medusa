"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { listProductsWithSort } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ProductPreview from "@modules/products/components/product-preview"

const PRODUCT_LIMIT = 12

export default function InfiniteProducts({
  initialProducts,
  region,
  countryCode,
  sortBy,
  count,
  collectionId,
  categoryId,
  productsIds,
}: {
  initialProducts: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
  countryCode: string
  sortBy?: SortOptions
  count: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(count > PRODUCT_LIMIT)
  const [isLoading, setIsLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset when initialProducts change (e.g. sort change)
  useEffect(() => {
    setProducts(initialProducts)
    setPage(1)
    setHasMore(count > PRODUCT_LIMIT)
  }, [initialProducts, count])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    setIsLoading(true)

    const nextPage = page + 1
    const queryParams: Record<string, unknown> = { limit: PRODUCT_LIMIT }
    if (collectionId) queryParams.collection_id = [collectionId]
    if (categoryId) queryParams.category_id = [categoryId]
    if (productsIds) queryParams.id = productsIds
    if (sortBy === "created_at") queryParams.order = "created_at"

    const { response } = await listProductsWithSort({
      page: nextPage,
      queryParams,
      sortBy,
      countryCode,
    })

    setProducts((prev) => [...prev, ...response.products])
    setPage(nextPage)
    setHasMore(nextPage * PRODUCT_LIMIT < response.count)
    setIsLoading(false)
  }, [
    isLoading,
    hasMore,
    page,
    collectionId,
    categoryId,
    productsIds,
    sortBy,
    countryCode,
  ])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <>
      <ul
        className="grid grid-cols-1 w-full small:grid-cols-3 medium:grid-cols-3 gap-x-6 gap-y-8"
        data-testid="products-list"
      >
        {products.map((p) => (
          <li key={p.id}>
            <ProductPreview
              product={p}
              region={region}
              countryCode={countryCode}
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center w-full mt-8 py-4">
          {isLoading && (
            <span className="text-ui-fg-muted animate-pulse">
              Loading more products...
            </span>
          )}
        </div>
      )}
    </>
  )
}
