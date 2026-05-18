"use client"

import { setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, useToggleState } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import { t } from "@lib/i18n"
import { useCallback, useEffect, useRef, useState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"

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

  const [message, setMessage] = useState<string | null>(
    addressSaved ? "success" : null
  )
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submitForm = useCallback(async () => {
    if (!formRef.current) return
    setSaving(true)
    const formData = new FormData(formRef.current)
    const result = await setAddresses(null, formData)
    setMessage(result)
    setSaving(false)
  }, [])

  const handleChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      submitForm()
    }, 1500)
  }, [submitForm])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          {t("checkout.shippingAddress")}
          {message === "success" && !saving && <CheckCircleSolid />}
        </Heading>
        {saving && (
          <span className="text-sm text-ui-fg-subtle">{t("checkout.saving") || "Saving..."}</span>
        )}
      </div>
      <form ref={formRef} onChange={handleChange}>
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
          <ErrorMessage error={message !== "success" ? message : null} data-testid="address-error-message" />
        </div>
      </form>
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
