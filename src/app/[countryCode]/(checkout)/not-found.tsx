import InteractiveLink from "@modules/common/components/interactive-link"
import { Metadata } from "next"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: t("notFound.title"),
  description: t("notFound.description"),
}

export default async function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("notFound.heading")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("notFound.body")}
      </p>
      <InteractiveLink href="/">{t("notFound.goHome")}</InteractiveLink>
    </div>
  )
}
