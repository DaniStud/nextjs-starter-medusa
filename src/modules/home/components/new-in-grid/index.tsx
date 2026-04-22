import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { t } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function NewInGrid({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  const { response } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 4,
      order: "-created_at",
    },
  })

  const products = response.products

  if (!products || products.length === 0) {
    return null
  }

  return (
    <section className="ml-auto w-full px-4 py-10 small:px-8 max-w-[90vw] md:max-w-[66vw] md:min-w-[66vw] mx-auto">
      {/* Section Header */}
      <div className="flex flex-col items-start justify-between gap-4 mb-8 sm:flex-row sm:items-center">
        <h2 className="text-xl font-heading font-bold text-gray-900 small:text-2xl">
          {t("home.newIn.heading")}
        </h2>
        <LocalizedClientLink href="/store">
          <button className="px-6 py-2 text-sm font-medium text-white transition-colors bg-brand border border-brand rounded-full whitespace-nowrap hover:bg-brand-dark">
            {t("home.newIn.cta")}
          </button>
        </LocalizedClientLink>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 large:grid-cols-4">
        {products.map((product) => {
          const { cheapestPrice } = getProductPrice({ product })
          const image = product.thumbnail || product.images?.[0]?.url

          return (
            <LocalizedClientLink
              key={product.id}
              href={`/products/${product.handle}`}
              className="flex flex-col cursor-pointer group"
            >
              {/* Image Container */}
              <div className="relative flex items-center justify-center w-full p-8 mb-4 overflow-hidden bg-[#f6f6f6] aspect-[3/4]">
                {image ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={image}
                      alt={product.title ?? t("home.newIn.productImageAlt")}
                      fill
                      className="object-contain object-center transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-300">
                    <span className="text-sm">{t("home.newIn.noImage")}</span>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex flex-col">
                {product.collection && (
                  <span className="mb-1 text-xs text-gray-500">
                    {product.collection.title}
                  </span>
                )}
                <span className="text-sm font-bold text-gray-900">
                  {product.title}
                </span>
                {product.subtitle && (
                  <span className="text-sm text-gray-600 line-clamp-1">
                    {product.subtitle}
                  </span>
                )}
                {cheapestPrice && (
                  <span className="mt-3 text-sm text-gray-900">
                    {cheapestPrice.calculated_price}
                  </span>
                )}
              </div>
            </LocalizedClientLink>
          )
        })}
      </div>
    </section>
  )
}
