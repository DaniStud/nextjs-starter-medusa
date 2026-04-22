"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { t } from "@lib/i18n"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import ProductExpressCheckout from "../express-checkout"
import { useCartDrawer } from "@lib/context/cart-drawer-context"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const countryCode = useParams().countryCode as string
  const { openDrawer } = useCartDrawer()

  // Preselect the smallest variant (first option value for each option)
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    } else if ((product.variants?.length ?? 0) > 1 && product.options?.length) {
      const defaultOptions: Record<string, string> = {}
      for (const option of product.options) {
        const firstValue = option.values?.[0]?.value
        if (firstValue) {
          defaultOptions[option.id] = firstValue
        }
      }
      setOptions(defaultOptions)
    }
  }, [product.variants, product.options])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    openDrawer()

    await addToCart({
      variantId: selectedVariant.id,
      quantity,
      countryCode,
    })

    setIsAdding(false)
  }

  return (
    <>
      <div className="flex flex-col gap-y-4 flex-1" ref={actionsRef}>
        <ProductPrice product={product} variant={selectedVariant} />

        {product.description && (
          <p
            className="text-base text-stone-600 whitespace-pre-line"
            data-testid="product-description"
          >
            {product.description}
          </p>
        )}

        <div className="mt-6 lg:mt-auto">
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4 mb-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
            </div>
          )}

        {/* Quantity selector + Add to cart button side by side */}
        <div className="flex flex-row items-stretch gap-4 w-full">
          <div className="flex items-center border border-stone-300 rounded-none shrink-0 w-fit">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg font-medium hover:bg-stone-50 transition-colors"
              disabled={quantity <= 1}
              aria-label={t("productActions.decreaseQuantity")}
            >
              −
            </button>
            <span className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-medium border-x border-stone-300">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg font-medium hover:bg-stone-50 transition-colors"
              aria-label={t("productActions.increaseQuantity")}
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={
              !inStock ||
              !selectedVariant ||
              !!disabled ||
              isAdding ||
              !isValidVariant
            }
            className="flex-1 bg-[#ed1d27] hover:bg-[#c4161f] text-white py-4 text-base font-semibold rounded-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="add-product-button"
          >
            {isAdding
              ? t("productActions.adding")
              : !selectedVariant && !options
                ? t("productActions.selectVariant")
                : !inStock || !isValidVariant
                  ? t("productActions.outOfStock")
                  : t("productActions.addToCart")}
          </button>
        </div>
        <div className="min-h-[44px]">
          <ProductExpressCheckout
            product={product}
            variant={selectedVariant}
            quantity={quantity}
            countryCode={countryCode}
          />
        </div>
        </div>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
