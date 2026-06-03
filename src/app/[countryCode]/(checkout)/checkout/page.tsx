import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import StripeReturnHandler from "@modules/checkout/components/stripe-return-handler"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: t("meta.checkout.title"),
}

export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const paymentIntentClientSecret =
    (params.payment_intent_client_secret as string) || null

  const cart = await retrieveCart()

  if (!cart) {
    // If returning from a redirect-based payment (MobilePay, etc.) but the
    // cart is already gone, the order was likely completed via webhook.
    // Redirect to the home page instead of showing a 404.
    if (paymentIntentClientSecret) {
      const { redirect } = await import("next/navigation")
      redirect("/")
    }
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-y-8 small:gap-x-12 py-12">
      <PaymentWrapper cart={cart}>
        {paymentIntentClientSecret ? (
          <StripeReturnHandler clientSecret={paymentIntentClientSecret} />
        ) : (
          <CheckoutForm cart={cart} customer={customer} />
        )}
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
