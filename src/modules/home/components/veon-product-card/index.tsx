import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Veon-style product card used by the homepage grids (Featured, New
 * Arrivals, Best Sellers, Our Best Products).
 *
 * - Full-bleed image with hover scale (like the Veon template cards)
 * - Optional badge (e.g. "Best Seller")
 * - Prices come from `getProductPrice`, which formats amounts through
 *   `convertToLocale()` from `src/lib/util/money.ts`
 */
export default function VeonProductCard({
  product,
  badge,
  aspectClassName = "aspect-[3/4]",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  product: HttpTypes.StoreProduct
  badge?: string
  aspectClassName?: string
  sizes?: string
}) {
  const { cheapestPrice } = getProductPrice({ product })
  const image = product.thumbnail || product.images?.[0]?.url

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group flex flex-col"
      data-testid="product-wrapper"
    >
      {/* Image */}
      <div
        className={`relative w-full overflow-hidden bg-[#f0f0f0] ${aspectClassName}`}
      >
        {image ? (
          <Image
            src={image}
            alt={product.title ?? ""}
            fill
            sizes={sizes}
            className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
            {product.title}
          </div>
        )}

        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-900 backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="mt-4 flex flex-col gap-y-1">
        {product.collection && (
          <span className="text-xs text-gray-500">
            {product.collection.title}
          </span>
        )}
        <span
          className="font-heading text-sm font-bold uppercase tracking-wide text-gray-900"
          data-testid="product-title"
        >
          {product.title}
        </span>
        {cheapestPrice && (
          <div className="flex items-center gap-x-2">
            {cheapestPrice.price_type === "sale" && (
              <span className="text-sm text-gray-400 line-through">
                {cheapestPrice.original_price}
              </span>
            )}
            <span className="text-sm text-gray-900">
              {cheapestPrice.calculated_price}
            </span>
          </div>
        )}
      </div>
    </LocalizedClientLink>
  )
}
