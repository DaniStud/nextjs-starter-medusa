"use client"

import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import {
  createExpressCheckoutSession,
  completeExpressCheckout,
} from "@lib/data/express-checkout"

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

type ExpressCheckoutProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  quantity: number
  countryCode: string
}

function ExpressCheckoutForm({
  product,
  variant,
  quantity,
  countryCode,
}: ExpressCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onConfirm = async (event: any) => {
    if (!stripe || !elements || !variant?.id) return

    setError(null)

    try {
      const { billingDetails, shippingAddress } =
        event.expressPaymentType === "apple_pay" ||
        event.expressPaymentType === "google_pay"
          ? {
              billingDetails: event.billingDetails,
              shippingAddress: event.shippingAddress,
            }
          : { billingDetails: null, shippingAddress: null }

      const address = shippingAddress?.address || billingDetails?.address
      const email = billingDetails?.email || ""
      const name = billingDetails?.name || shippingAddress?.name || ""

      // 1. Create cart + payment session on the server
      const { clientSecret, cartId } = await createExpressCheckoutSession({
        variantId: variant.id,
        quantity,
        countryCode,
        shippingAddress: {
          address_1: address?.line1 || "",
          city: address?.city || "",
          postal_code: address?.postal_code || "",
          country_code: address?.country || countryCode,
          province: address?.state || "",
        },
        email,
        name,
      })

      // 2. Confirm the payment with Stripe
      const { error: stripeError } = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/${countryCode}/order/confirmed`,
        },
        redirect: "if_required",
      })

      if (stripeError) {
        setError(stripeError.message || "Payment failed")
        return
      }

      // 3. Complete the order on Medusa
      const result = await completeExpressCheckout(cartId)

      if (result.success && result.orderId) {
        router.push(
          `/${result.countryCode || countryCode}/order/${result.orderId}/confirmed`
        )
      } else {
        setError("Order completion failed. Please contact support.")
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    }
  }

  return (
    <div className="w-full">
      <ExpressCheckoutElement
        onConfirm={onConfirm}
        options={{
          buttonType: {
            applePay: "buy",
            googlePay: "buy",
          },
        }}
      />
      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}

export default function ProductExpressCheckout({
  product,
  variant,
  quantity,
  countryCode,
}: ExpressCheckoutProps) {
  // Get price in smallest currency unit for Stripe
  const priceData = useMemo(() => {
    const v = variant as any
    if (!v?.calculated_price?.calculated_amount) return null
    return {
      amount: Math.round(v.calculated_price.calculated_amount * quantity),
      currency: v.calculated_price.currency_code?.toLowerCase() || "eur",
    }
  }, [variant, quantity])

  if (!stripePromise || !priceData || !variant) return null

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: priceData.amount,
        currency: priceData.currency,
        appearance: {
          theme: "stripe",
        },
      }}
    >
      <ExpressCheckoutForm
        product={product}
        variant={variant}
        quantity={quantity}
        countryCode={countryCode}
      />
    </Elements>
  )
}
