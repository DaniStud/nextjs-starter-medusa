import { Heading } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"
import { t } from "@lib/i18n"

const Help = () => {
  return (
    <div className="mt-6">
      <Heading className="text-base-semi">{t("order.needHelp")}</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <LocalizedClientLink href="/contact">{t("order.contactLink")}</LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href="/contact">
              {t("order.returnsExchanges")}
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
