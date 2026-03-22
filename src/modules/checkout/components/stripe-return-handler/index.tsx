"use client"

import { placeOrder } from "@lib/data/cart"
import { Heading, Text } from "@medusajs/ui"
import { useStripe } from "@stripe/react-stripe-js"
import { useEffect, useRef, useState } from "react"

const StripeReturnHandler = ({
  clientSecret,
}: {
  clientSecret: string
}) => {
  const stripe = useStripe()
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handled = useRef(false)

  useEffect(() => {
    if (!stripe || !clientSecret || handled.current) return
    handled.current = true

    stripe.retrievePaymentIntent(clientSecret).then(async ({ paymentIntent }) => {
      if (!paymentIntent) {
        setStatus("error")
        setErrorMessage("Could not retrieve payment status.")
        return
      }

      switch (paymentIntent.status) {
        case "succeeded":
        case "requires_capture":
          try {
            await placeOrder()
            setStatus("success")
          } catch (err: any) {
            setStatus("error")
            setErrorMessage(err.message || "Failed to place order.")
          }
          break
        case "processing":
          setStatus("loading")
          break
        default:
          setStatus("error")
          setErrorMessage(
            `Payment was not successful. Status: ${paymentIntent.status}`
          )
      }
    })
  }, [stripe, clientSecret])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ui-fg-base" />
        <Heading level="h2" className="text-2xl">
          Processing your payment...
        </Heading>
        <Text className="text-ui-fg-subtle">
          Please wait while we confirm your payment.
        </Text>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Heading level="h2" className="text-2xl text-ui-fg-error">
          Payment failed
        </Heading>
        <Text className="text-ui-fg-subtle">
          {errorMessage || "Something went wrong with your payment."}
        </Text>
        <a
          href="."
          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover underline"
        >
          Return to checkout
        </a>
      </div>
    )
  }

  // Success state — placeOrder will redirect, so this rarely shows
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Heading level="h2" className="text-2xl">
        Payment confirmed!
      </Heading>
      <Text className="text-ui-fg-subtle">Redirecting to your order...</Text>
    </div>
  )
}

export default StripeReturnHandler
