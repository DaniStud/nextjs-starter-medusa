"use client"

import { useEffect } from "react"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { convertToLocale } from "@lib/util/money"
import { t } from "@lib/i18n"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { XMark } from "@medusajs/icons"

export default function CartDrawer() {
  const { isOpen, closeDrawer, cart } = useCartDrawer()

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey)
    }
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, closeDrawer])

  const items = cart?.items ?? []
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)
  const subtotal = cart?.subtotal ?? 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-[101] h-full w-full max-w-[420px] bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("cartDrawer.heading")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {t("cartDrawer.heading")} ({totalItems})
          </h2>
          <button
            onClick={closeDrawer}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label={t("cartDrawer.close")}
          >
            <XMark className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        {items.length > 0 ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-y-6">
                {items
                  .sort((a, b) =>
                    (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[80px_1fr] gap-x-4"
                      data-testid="cart-drawer-item"
                    >
                      <LocalizedClientLink
                        href={`/products/${item.product_handle}`}
                        onClick={closeDrawer}
                      >
                        <Thumbnail
                          thumbnail={item.thumbnail}
                          size="square"
                        />
                      </LocalizedClientLink>
                      <div className="flex flex-col justify-between min-w-0">
                        <div>
                          <LocalizedClientLink
                            href={`/products/${item.product_handle}`}
                            onClick={closeDrawer}
                            className="text-sm font-medium text-ui-fg-base hover:text-ui-fg-subtle truncate block"
                          >
                            {item.title}
                          </LocalizedClientLink>
                          <LineItemOptions
                            variant={item.variant}
                            data-testid="cart-drawer-item-variant"
                          />
                          <span className="text-xs text-ui-fg-muted">
                            {t("cartDropdown.quantity", {
                              count: item.quantity,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <DeleteButton
                            id={item.id}
                            data-testid="cart-drawer-remove"
                          >
                            {t("cartDropdown.remove")}
                          </DeleteButton>
                          <LineItemPrice
                            item={item}
                            style="tight"
                            currencyCode={cart?.currency_code ?? ""}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="border-t border-gray-200 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {t("cartDropdown.subtotal")}
                </span>
                <span className="text-base font-semibold" data-testid="cart-drawer-subtotal">
                  {convertToLocale({
                    amount: subtotal,
                    currency_code: cart?.currency_code ?? "",
                  })}
                </span>
              </div>
              <LocalizedClientLink href="/checkout" onClick={closeDrawer}>
                <button
                  className="w-full bg-ui-fg-base text-white rounded-full py-3 text-sm font-medium hover:bg-ui-fg-base/90 transition-colors"
                  data-testid="cart-drawer-checkout"
                >
                  {t("cartDrawer.checkout")}
                </button>
              </LocalizedClientLink>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-y-4 px-5">
            <div className="bg-gray-900 text-white text-sm flex items-center justify-center w-8 h-8 rounded-full">
              0
            </div>
            <p className="text-ui-fg-muted">{t("cartDrawer.empty")}</p>
            <LocalizedClientLink href="/store" onClick={closeDrawer}>
              <button className="text-sm text-ui-fg-interactive hover:text-ui-fg-base underline transition-colors">
                {t("cartDrawer.continueShopping")}
              </button>
            </LocalizedClientLink>
          </div>
        )}
      </div>
    </>
  )
}
