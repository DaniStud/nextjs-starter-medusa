import { Text } from "@medusajs/ui"

import { t } from "@lib/i18n"
import NewsletterForm from "@modules/layout/components/newsletter-form"

export default async function Footer() {
  return (
    <footer className="border-t border-ui-border-base w-full bg-stone-900 mt-12">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-6 small:flex-row items-start justify-between py-6">
          <div className="flex flex-col gap-y-4">
            <Text className="txt-compact-large-plus text-stone-100 font-semibold">
              {t("footer.newsletter")}
            </Text>
            <NewsletterForm />
          </div>
          <div className="flex items-end">
            <Text className="txt-compact-small text-stone-400">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </Text>
          </div>
        </div>
        <div className="flex w-full mb-8 text-stone-400">
          <Text className="txt-compact-small">
            {t("footer.privacyNotice")}
          </Text>
        </div>
      </div>
    </footer>
  )
}
