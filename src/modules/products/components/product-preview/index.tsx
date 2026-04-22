import { Text } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import QuickAddButton from "./quick-add-button"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
  countryCode,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  countryCode?: string
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  return (
    <div data-testid="product-wrapper">
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className="group"
      >
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          isFeatured={isFeatured}
        />
      </LocalizedClientLink>
      <div className="flex txt-compact-medium mt-4 justify-between items-start gap-x-2">
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="flex flex-col min-w-0"
        >
          <Text className="text-ui-fg-subtle truncate" data-testid="product-title">
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </LocalizedClientLink>
        {countryCode && (
          <QuickAddButton product={product} countryCode={countryCode} />
        )}
      </div>
    </div>
  )
}
