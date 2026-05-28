"use client"

import { setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, useToggleState } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import { t } from "@lib/i18n"
import { useActionState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const addressSaved = !!(cart?.shipping_address && cart?.email)

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  const [message, formAction] = useActionState(setAddresses, null)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          {t("checkout.shippingAddress")}
          {addressSaved && message === "success" && <CheckCircleSolid />}
        </Heading>
      </div>
      <form action={formAction}>
        <div className="pb-8">
          <ShippingAddress
            customer={customer}
            checked={sameAsBilling}
            onChange={toggleSameAsBilling}
            cart={cart}
          />

          {!sameAsBilling && (
            <div>
              <Heading
                level="h2"
                className="text-3xl-regular gap-x-4 pb-6 pt-8"
              >
                {t("checkout.billingAddress")}
              </Heading>

              <BillingAddress cart={cart} />
            </div>
          )}
          <SubmitButton className="mt-6" data-testid="submit-address-button">
            {t("checkout.continueToDelivery")}
          </SubmitButton>
          <ErrorMessage error={message !== "success" ? message : null} data-testid="address-error-message" />
        </div>
      </form>
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
