"use client"

import { RadioGroup } from "@headlessui/react"
import { isStripe as isStripeFunc, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { t } from "@lib/i18n"
import { Heading, Text } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripePaymentElementContainer,
} from "@modules/checkout/components/payment-container"
import PaymentButton from "@modules/checkout/components/payment-button"
import Divider from "@modules/common/components/divider"
import { useEffect, useState } from "react"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [error, setError] = useState<string | null>(null)
  const [stripeComplete, setStripeComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeFunc(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  // Auto-initiate the first payment method when no session exists yet
  useEffect(() => {
    if (
      !activeSession &&
      !selectedPaymentMethod &&
      availablePaymentMethods?.length > 0
    ) {
      const firstMethod = availablePaymentMethods[0]
      setPaymentMethod(firstMethod.id)
    }
  }, [availablePaymentMethods])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          {t("checkout.payment")}
        </Heading>
      </div>
      <div>
        <div>
          {!paidByGiftcard && availablePaymentMethods?.length > 0 && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeFunc(paymentMethod.id) ? (
                      <StripePaymentElementContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setError={setError}
                        setPaymentReady={setStripeComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {!paidByGiftcard && availablePaymentMethods?.length === 0 && (
            <Text className="txt-medium text-ui-fg-subtle">
              {t("checkout.noPaymentMethods")}
            </Text>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-full small:w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          {/* Place order button — shown directly once payment method is selected */}
          <div className="mt-6">
            <Text className="txt-medium-plus text-ui-fg-base mb-4">
              {t("checkout.reviewLegal")}
            </Text>
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          </div>
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
