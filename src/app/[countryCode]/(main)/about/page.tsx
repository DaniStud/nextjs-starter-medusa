import { Metadata } from "next"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: `${t("about.heading")} | ${t("nav.brand")}`,
  description: t("about.body"),
}

export default function AboutPage() {
  return (
    <div className="content-container py-12 small:py-24">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold font-heading uppercase tracking-tight mb-8">
          {t("about.heading")}
        </h1>
        <p className="text-stone-600 text-base leading-relaxed">
          {t("about.body")}
        </p>
      </div>
    </div>
  )
}
