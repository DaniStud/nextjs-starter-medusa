"use client"

import { useState, useRef, useEffect } from "react"
import { addToCart } from "@lib/data/cart"
import { t } from "@lib/i18n"
import { HttpTypes } from "@medusajs/types"
import { useCartDrawer } from "@lib/context/cart-drawer-context"

type QuickAddButtonProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default function QuickAddButton({
  product,
  countryCode,
}: QuickAddButtonProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [showSizes, setShowSizes] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { openDrawer } = useCartDrawer()

  const variants = product.variants ?? []
  const isSingleVariant = variants.length <= 1

  // Close popover on outside click
  useEffect(() => {
    if (!showSizes) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowSizes(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showSizes])

  const handleAdd = async (variantId: string) => {
    setIsAdding(true)
    setShowSizes(false)
    openDrawer()
    try {
      await addToCart({ variantId, quantity: 1, countryCode })
    } catch {
      // Silently fail — cart will refresh on next load
    } finally {
      setIsAdding(false)
    }
  }

  const handleClick = () => {
    if (isSingleVariant && variants[0]?.id) {
      handleAdd(variants[0].id)
    } else {
      setShowSizes((prev) => !prev)
    }
  }

  // Get size/option label for each variant
  const getVariantLabel = (variant: HttpTypes.StoreProductVariant) => {
    const optionValues = (variant as any).option_values
    if (optionValues?.length) {
      return optionValues.map((ov: any) => ov.value).join(" / ")
    }
    return variant.title ?? ""
  }

  const hasStock = (variant: HttpTypes.StoreProductVariant) => {
    if (!(variant as any).manage_inventory) return true
    if ((variant as any).allow_backorder) return true
    return ((variant as any).inventory_quantity ?? 0) > 0
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={handleClick}
        disabled={isAdding || variants.length === 0}
        className="whitespace-nowrap rounded-full bg-ui-fg-base text-white text-xs font-medium px-3 py-1.5 hover:bg-ui-fg-base/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="quick-add-button"
      >
        {isAdding
          ? t("quickAdd.adding")
          : isSingleVariant
            ? t("quickAdd.addToCart")
            : t("quickAdd.selectSize")}
      </button>

      {showSizes && !isSingleVariant && (
        <div className="absolute right-0 bottom-full mb-2 z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[140px]">
          <p className="text-xs text-ui-fg-muted px-2 pb-1.5 font-medium">
            {t("quickAdd.selectSize")}
          </p>
          <div className="flex flex-col gap-1">
            {variants.map((variant) => {
              const inStock = hasStock(variant)
              return (
                <button
                  key={variant.id}
                  onClick={() => variant.id && handleAdd(variant.id)}
                  disabled={!inStock || isAdding}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  data-testid={`quick-add-variant-${variant.id}`}
                >
                  {getVariantLabel(variant)}
                  {!inStock && (
                    <span className="ml-1 text-xs text-ui-fg-muted">
                      ({t("quickAdd.outOfStock")})
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
