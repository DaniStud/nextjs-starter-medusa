"use client"

import { isManual, isStripe } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useState } from "react"
import { t } from "@lib/i18n"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return <Button disabled>{t("checkout.selectPaymentMethod")}</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!stripe || !elements || !cart) {
      setSubmitting(false)
      return
    }

    // Validate the PaymentElement form first
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setErrorMessage(submitError.message || t("checkout.checkPaymentDetails"))
      setSubmitting(false)
      return
    }

    const countryCode = cart.shipping_address?.country_code || "us"
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000"

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: session?.data.client_secret as string,
      confirmParams: {
        return_url: `${baseUrl}/${countryCode}/checkout?step=review&payment_intent_client_secret=${session?.data.client_secret}`,
      },
      redirect: "if_required",
    })

    if (error) {
      // If the error has a payment intent that succeeded/requires_capture, still complete
      const pi = error.payment_intent
      if (
        pi &&
        (pi.status === "requires_capture" || pi.status === "succeeded")
      ) {
        await onPaymentCompleted()
        return
      }

      setErrorMessage(error.message || t("checkout.unexpectedError"))
      setSubmitting(false)
      return
    }

    if (
      paymentIntent &&
      (paymentIntent.status === "requires_capture" ||
        paymentIntent.status === "succeeded")
    ) {
      await onPaymentCompleted()
      return
    }

    // For any other status, stop submitting and let the user know
    setSubmitting(false)
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        {t("checkout.placeOrder")}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        {t("checkout.placeOrder")}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
