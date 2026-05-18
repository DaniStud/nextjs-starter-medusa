"use client"

import { RadioGroup, Radio as RadioGroupOption } from "@headlessui/react"
import { isStripe as isStripeFunc } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { t } from "@lib/i18n"
import { Heading, Text, clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentButton from "@modules/checkout/components/payment-button"
import Divider from "@modules/common/components/divider"
import Radio from "@modules/common/components/radio"
import { useContext, useEffect, useState } from "react"
import { PaymentElement } from "@stripe/react-stripe-js"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"

type PaymentOption = "mobilepay" | "card"

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
  const [selectedOption, setSelectedOption] = useState<PaymentOption>("mobilepay")
  const [sessionInitiated, setSessionInitiated] = useState(!!activeSession)

  const stripeReady = useContext(StripeContext)

  const stripeProvider = availablePaymentMethods?.find((m) =>
    isStripeFunc(m.id)
  )

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  // Initiate Stripe payment session on mount (needed for both MobilePay and Card)
  useEffect(() => {
    if (!activeSession && stripeProvider && !sessionInitiated) {
      setSessionInitiated(true)
      initiatePaymentSession(cart, { provider_id: stripeProvider.id })
    }
  }, [stripeProvider, activeSession, sessionInitiated])

  const handleOptionChange = (value: PaymentOption) => {
    setError(null)
    setSelectedOption(value)
  }

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
          {!paidByGiftcard && stripeProvider && (
            <RadioGroup
              value={selectedOption}
              onChange={handleOptionChange}
            >
              {/* MobilePay option */}
              <RadioGroupOption
                value="mobilepay"
                className={clx(
                  "flex flex-col gap-y-2 text-small-regular cursor-pointer py-4 border rounded-rounded px-4 small:px-8 mb-2 hover:shadow-borders-interactive-with-active",
                  {
                    "border-ui-border-interactive": selectedOption === "mobilepay",
                  }
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-4">
                    <Radio checked={selectedOption === "mobilepay"} />
                    <Text className="text-base-regular">MobilePay</Text>
                  </div>
                  <MobilePayIcon />
                </div>
              </RadioGroupOption>

              {/* Card option (includes Apple Pay + Google Pay wallets) */}
              <RadioGroupOption
                value="card"
                className={clx(
                  "flex flex-col gap-y-2 text-small-regular cursor-pointer py-4 border rounded-rounded px-4 small:px-8 mb-2 hover:shadow-borders-interactive-with-active",
                  {
                    "border-ui-border-interactive": selectedOption === "card",
                  }
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-4">
                    <Radio checked={selectedOption === "card"} />
                    <Text className="text-base-regular">{t("payment.creditCard")}</Text>
                  </div>
                  <CreditCardIcon />
                </div>
                {selectedOption === "card" &&
                  (stripeReady ? (
                    <div className="my-4 transition-all duration-150 ease-in-out">
                      <PaymentElement
                        options={{
                          layout: "tabs",
                          wallets: { applePay: "auto", googlePay: "auto" },
                          paymentMethodOrder: ["card", "apple_pay", "google_pay"],
                        }}
                        onChange={(e) => {
                          setStripeComplete(e.complete)
                          setError(e.complete ? null : null)
                        }}
                      />
                    </div>
                  ) : (
                    <SkeletonCardDetails />
                  ))}
              </RadioGroupOption>
            </RadioGroup>
          )}

          {!paidByGiftcard && !stripeProvider && (
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

          {/* Place order button */}
          <div className="mt-6">
            <Text className="txt-medium-plus text-ui-fg-base mb-4">
              {t("checkout.reviewLegal")}
            </Text>
            <PaymentButton
              cart={cart}
              data-testid="submit-order-button"
              paymentType={selectedOption}
            />
          </div>
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment

function MobilePayIcon() {
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="24" rx="4" fill="#5A78FF" />
      <path d="M13 7h2l3 5 3-5h2v10h-2V10.5l-3 4.5-3-4.5V17h-2V7z" fill="white" />
      <path d="M25 7h2v10h-2V7z" fill="white" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="39" height="23" rx="3.5" stroke="#E5E7EB" fill="white" />
      <rect x="4" y="6" width="32" height="4" rx="1" fill="#D1D5DB" />
      <rect x="4" y="14" width="12" height="2" rx="1" fill="#9CA3AF" />
      <rect x="4" y="18" width="8" height="2" rx="1" fill="#9CA3AF" />
    </svg>
  )
}
