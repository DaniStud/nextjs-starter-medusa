import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { t } from "@lib/i18n"
import ProductPreview from "@modules/products/components/product-preview"

export default async function ProductRail({
  collection,
  region,
  countryCode,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
  countryCode?: string
}) {
  const {
    response: { products: pricedProducts },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      collection_id: collection.id,
      fields: "*variants.calculated_price",
    },
  })

  if (!pricedProducts) {
    return null
  }

  return (
    <div className="content-container py-12 small:py-24">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl text-stone-500 font-medium font-heading uppercase tracking-wide">
          {t("home.featured.heading")}
        </h2>
        <LocalizedClientLink
          href="/store"
          className="contrast-btn px-8 py-3 text-sm font-semibold inline-block"
        >
          {t("home.featured.seeAll")}
        </LocalizedClientLink>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {pricedProducts &&
          pricedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                isFeatured
                countryCode={countryCode}
              />
            </li>
          ))}
      </ul>
    </div>
  )
}
