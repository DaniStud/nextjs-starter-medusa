"use client"

import { placeOrder } from "@lib/data/cart"
import { Heading, Text } from "@medusajs/ui"
import { t } from "@lib/i18n"
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
        setErrorMessage(t("stripe.noStatus"))
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
            setErrorMessage(err.message || t("stripe.failedOrder"))
          }
          break
        case "processing":
          setStatus("loading")
          break
        default:
          setStatus("error")
          setErrorMessage(
            t("stripe.notSuccessful", { status: paymentIntent.status })
          )
      }
    })
  }, [stripe, clientSecret])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ui-fg-base" />
        <Heading level="h2" className="text-2xl">
          {t("stripe.processing")}
        </Heading>
        <Text className="text-ui-fg-subtle">
          {t("stripe.pleaseWait")}
        </Text>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Heading level="h2" className="text-2xl text-ui-fg-error">
          {t("stripe.failed")}
        </Heading>
        <Text className="text-ui-fg-subtle">
          {errorMessage || t("stripe.somethingWrong")}
        </Text>
        <a
          href="."
          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover underline"
        >
          {t("stripe.returnToCheckout")}
        </a>
      </div>
    )
  }

  // Success state — placeOrder will redirect, so this rarely shows
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Heading level="h2" className="text-2xl">
        {t("stripe.confirmed")}
      </Heading>
      <Text className="text-ui-fg-subtle">{t("stripe.redirecting")}</Text>
    </div>
  )
}

export default StripeReturnHandler
