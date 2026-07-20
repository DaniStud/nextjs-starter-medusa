import { HttpTypes } from "@medusajs/types"
import ProductRail from "@modules/home/components/featured-products/product-rail"

export default async function FeaturedProducts({
  collections,
  region,
  countryCode,
}: {
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion
  countryCode?: string
}) {
  return collections.map((collection) => (
    <li key={collection.id}>
      <ProductRail collection={collection} region={region} countryCode={countryCode} />
    </li>
  ))
}
