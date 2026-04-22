import { ArrowUpRightMini } from "@medusajs/icons"
import { Text } from "@medusajs/ui"
import { Metadata } from "next"
import Link from "next/link"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: t("notFound.title"),
  description: t("notFound.description"),
}

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("notFound.heading")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("notFound.body")}
      </p>
      <Link
        className="flex gap-x-1 items-center group"
        href="/"
      >
        <Text className="text-ui-fg-interactive">{t("notFound.goHome")}</Text>
        <ArrowUpRightMini
          className="group-hover:rotate-45 ease-in-out duration-150"
          color="var(--fg-interactive)"
        />
      </Link>
    </div>
  )
}
