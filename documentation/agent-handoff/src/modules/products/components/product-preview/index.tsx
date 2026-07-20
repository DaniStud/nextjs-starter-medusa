"use client"

import { Text } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import QuickAddButton from "./quick-add-button"

export default function ProductPreview({
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
    <div data-testid="product-wrapper" className="flex flex-col">
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
      <div className="grid grid-cols-2 mt-4 gap-x-4 items-center">
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="flex flex-col gap-y-1 min-w-0"
        >
          <Text
            className="text-ui-fg-base font-heading font-bold uppercase text-sm tracking-wide truncate"
            data-testid="product-title"
          >
            {product.title}
          </Text>
          {cheapestPrice && (
            <div className="flex items-center gap-x-2">
              <PreviewPrice price={cheapestPrice} />
            </div>
          )}
        </LocalizedClientLink>
        {countryCode && (
          <div className="flex justify-end">
            <QuickAddButton product={product} countryCode={countryCode} />
          </div>
        )}
      </div>
    </div>
  )
}
