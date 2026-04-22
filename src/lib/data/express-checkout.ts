"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  setCartId,
  removeCartId,
} from "./cookies"
import { getRegion } from "./regions"

/**
 * Creates a cart, adds a line item, sets addresses from Express Checkout,
 * initiates a Stripe payment session, and returns the client_secret
 * so the frontend can confirm the payment.
 */
export async function createExpressCheckoutSession({
  variantId,
  quantity,
  countryCode,
  shippingAddress,
  email,
  name,
}: {
  variantId: string
  quantity: number
  countryCode: string
  shippingAddress: {
    address_1: string
    city: string
    postal_code: string
    country_code: string
    province?: string
  }
  email: string
  name: string
}) {
  const region = await getRegion(countryCode)
  if (!region) {
    throw new Error("Region not found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  // 1. Create a fresh cart for this express checkout
  const { cart } = await sdk.store.cart.create(
    { region_id: region.id },
    {},
    headers
  )
  await setCartId(cart.id)

  // 2. Add the line item
  await sdk.store.cart.createLineItem(
    cart.id,
    { variant_id: variantId, quantity },
    {},
    headers
  )

  // 3. Set shipping + billing address and email
  const nameParts = name.split(" ")
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""

  const addressData = {
    first_name: firstName,
    last_name: lastName,
    address_1: shippingAddress.address_1,
    address_2: "",
    city: shippingAddress.city,
    postal_code: shippingAddress.postal_code,
    country_code: shippingAddress.country_code.toLowerCase(),
    province: shippingAddress.province || "",
    phone: "",
    company: "",
  }

  await sdk.store.cart.update(
    cart.id,
    {
      email,
      shipping_address: addressData,
      billing_address: addressData,
    },
    {},
    headers
  )

  // 4. Fetch available shipping options and pick the first one
  const shippingOptions = await sdk.client.fetch<{
    shipping_options: any[]
  }>(`/store/shipping-options`, {
    query: { cart_id: cart.id },
    headers,
  })

  if (shippingOptions.shipping_options?.length) {
    await sdk.store.cart.addShippingMethod(
      cart.id,
      { option_id: shippingOptions.shipping_options[0].id },
      {},
      headers
    )
  }

  // 5. Refresh the cart to get payment_collection
  const updatedCartRes = await sdk.store.cart.retrieve(cart.id, {}, headers)
  const updatedCart = updatedCartRes.cart as HttpTypes.StoreCart

  // 6. Initiate Stripe payment session
  const paymentResp = await sdk.store.payment.initiatePaymentSession(
    updatedCart,
    { provider_id: "pp_stripe_stripe" },
    {},
    headers
  )

  const paymentSession = (paymentResp as any)?.payment_collection
    ?.payment_sessions?.find((s: any) => s.provider_id === "pp_stripe_stripe")

  if (!paymentSession?.data?.client_secret) {
    throw new Error("Failed to create Stripe payment session")
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  return {
    clientSecret: paymentSession.data.client_secret as string,
    cartId: cart.id,
  }
}

/**
 * Completes an express checkout order after Stripe confirmation.
 */
export async function completeExpressCheckout(cartId: string) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart.complete(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    removeCartId()

    return {
      success: true,
      orderId: cartRes.order.id,
      countryCode,
    }
  }

  return { success: false }
}
