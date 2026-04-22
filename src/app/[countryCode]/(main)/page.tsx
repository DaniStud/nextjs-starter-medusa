import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import NewInGrid from "@modules/home/components/new-in-grid"
import Newsletter from "@modules/home/components/newsletter"
import ScrollReveal from "@modules/common/components/scroll-reveal"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: t("meta.home.title"),
  description:
    t("meta.home.description"),
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero/>
      <ScrollReveal>
        <NewInGrid region={region} countryCode={countryCode} />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <div className="py-12">
          <ul className="flex flex-col gap-x-6">
            <FeaturedProducts collections={collections} region={region} countryCode={countryCode} />
          </ul>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={200}>
        <Newsletter />
      </ScrollReveal>
    </>
  )
}
