"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { HttpTypes } from "@medusajs/types"

type CartDrawerContextType = {
  isOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  cart: HttpTypes.StoreCart | null
  setCart: (cart: HttpTypes.StoreCart | null) => void
}

const CartDrawerContext = createContext<CartDrawerContextType | null>(null)

export function CartDrawerProvider({
  children,
  initialCart,
}: {
  children: React.ReactNode
  initialCart?: HttpTypes.StoreCart | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(
    initialCart ?? null
  )

  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => setIsOpen(false), [])

  return (
    <CartDrawerContext.Provider
      value={{ isOpen, openDrawer, closeDrawer, cart, setCart }}
    >
      {children}
    </CartDrawerContext.Provider>
  )
}

export function useCartDrawer() {
  const context = useContext(CartDrawerContext)
  if (!context) {
    throw new Error("useCartDrawer must be used within a CartDrawerProvider")
  }
  return context
}
