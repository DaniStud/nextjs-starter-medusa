"use client"

import { HttpTypes } from "@medusajs/types"
import { t } from "@lib/i18n"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { useEffect } from "react"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const { openDrawer, setCart } = useCartDrawer()

  // Sync server-fetched cart into the drawer context
  useEffect(() => {
    if (cartState !== undefined) {
      setCart(cartState ?? null)
    }
  }, [cartState, setCart])

  const totalItems =
    cartState?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

  return (
    <div className="h-full z-50">
      <button
        className="h-full hover:text-ui-fg-base relative flex items-center"
        onClick={openDrawer}
        data-testid="nav-cart-link"
        aria-label={t("nav.cart", { count: totalItems })}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -right-1.5 bg-brand text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full" style={{ top: "0.8rem" }}>
            {totalItems}
          </span>
        )}
      </button>
    </div>
  )
}

export default CartDropdown
