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
        className="h-full hover:text-ui-fg-base"
        onClick={openDrawer}
        data-testid="nav-cart-link"
      >
        {t("nav.cart", { count: totalItems })}
      </button>
    </div>
  )
}

export default CartDropdown
