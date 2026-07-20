import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ScrollReveal from "@modules/common/components/scroll-reveal"

const FEATURE_COPY = [
  {
    heading: "Elevate Your Style",
    body: "Discover sophisticated silhouettes and premium fabrics, designed for timeless everyday style.",
  },
  {
    heading: "Redefine Casual Comfort",
    body: "Experience premium materials and modern fits, made for effortless layering all season long.",
  },
]

/**
 * Two alternating full-width feature blocks (image | text + CTA), each
 * highlighting a Medusa collection — mirroring the Veon "New in Dresses /
 * New in T-Shirts" sections. Blocks alternate sides on desktop and stack
 * on mobile.
 */
export default function CollectionFeatures({
  collections,
}: {
  collections: HttpTypes.StoreCollection[]
}) {
  const featured = collections?.slice(0, 2) ?? []

  if (featured.length === 0) {
    return null
  }

  return (
    <section className="mx-auto flex w-full max-w-[92rem] flex-col gap-16 px-5 py-16 small:gap-24 small:px-10 small:py-24">
      {featured.map((collection, i) => {
        const copy = FEATURE_COPY[i % FEATURE_COPY.length]
        const reversed = i % 2 === 1

        return (
          <ScrollReveal
            key={collection.id}
            direction={reversed ? "right" : "left"}
          >
            <div className="grid grid-cols-1 items-stretch small:grid-cols-2">
              {/* Image side */}
              <div
                className={`relative aspect-[4/3] overflow-hidden bg-gray-900 small:aspect-auto small:min-h-[560px] ${
                  reversed ? "small:order-2" : ""
                }`}
              >
                <Image
                  src="/images/veon-placeholder.jpg"
                  alt={collection.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-center"
                />
              </div>

              {/* Text side */}
              <div
                className={`flex flex-col items-start justify-center bg-[#f6f6f6] p-8 small:p-16 medium:p-24 ${
                  reversed ? "small:order-1" : ""
                }`}
              >
                <span className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-brand">
                  New in {collection.title}
                </span>
                <h3 className="mb-5 font-heading text-3xl font-bold uppercase tracking-tight text-gray-900 small:text-4xl">
                  {copy.heading}
                </h3>
                <p className="mb-8 max-w-md text-base text-gray-600">
                  {copy.body}
                </p>
                <LocalizedClientLink
                  href={`/collections/${collection.handle}`}
                  className="rounded-full bg-gray-900 px-9 py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-brand"
                >
                  Shop Now
                </LocalizedClientLink>
              </div>
            </div>
          </ScrollReveal>
        )
      })}
    </section>
  )
}
