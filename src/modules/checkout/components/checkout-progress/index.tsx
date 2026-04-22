"use client"

import { t } from "@lib/i18n"

const steps = [
  { key: "address", labelKey: "checkout.shippingAddress" },
  { key: "delivery", labelKey: "checkout.delivery" },
  { key: "payment", labelKey: "checkout.payment" },
] as const

export default function CheckoutProgress() {
  return (
    <div className="flex items-center gap-x-2 text-sm" data-testid="checkout-progress">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-x-2">
          {i > 0 && (
            <div className="w-8 h-px bg-ui-fg-base" />
          )}
          <div className="flex items-center gap-x-1.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-ui-fg-base text-white">
              {i + 1}
            </span>
            <span className="hidden small:inline text-ui-fg-base font-medium">
              {t(step.labelKey)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
