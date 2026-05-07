"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { HttpTypes } from "@medusajs/types"

type CartDrawerContextType = {
  isOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  cart: HttpTypes.StoreCart | null
  setCart: (cart: HttpTypes.StoreCart | null) => void
  optimisticDelta: number
  addOptimisticDelta: (delta: number) => void
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
  const [cart, setCartState] = useState<HttpTypes.StoreCart | null>(
    initialCart ?? null
  )
  const [optimisticDelta, setOptimisticDelta] = useState(0)

  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => setIsOpen(false), [])

  const setCart = useCallback((newCart: HttpTypes.StoreCart | null) => {
    setCartState(newCart)
    setOptimisticDelta(0) // reset delta when real cart arrives
  }, [])

  const addOptimisticDelta = useCallback((delta: number) => {
    setOptimisticDelta((prev) => prev + delta)
  }, [])

  return (
    <CartDrawerContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        cart,
        setCart,
        optimisticDelta,
        addOptimisticDelta,
      }}
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
