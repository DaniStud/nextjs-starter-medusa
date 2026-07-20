import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ScrollReveal from "@modules/common/components/scroll-reveal"
import SectionHeading from "@modules/home/components/section-heading"

/**
 * Veon-style category cards — 3-column grid of image cards with text
 * overlays, built from Medusa collections. Carries the `#shop` anchor
 * targeted by the nav "Shop" link and the hero CTAs.
 */
export default function CategoryCards({
  collections,
}: {
  collections: HttpTypes.StoreCollection[]
}) {
  const cards = collections?.slice(0, 3) ?? []

  if (cards.length === 0) {
    // Keep the #shop anchor working even without collections.
    return <div id="shop" className="scroll-mt-24" />
  }

  return (
    <section
      id="shop"
      className="mx-auto w-full max-w-[92rem] scroll-mt-24 px-5 py-16 small:px-10 small:py-24"
    >
      <ScrollReveal>
        <SectionHeading title="Shop by Collection" />
      </ScrollReveal>

      <ScrollReveal
        stagger={120}
        className="grid grid-cols-1 gap-5 xsmall:grid-cols-2 small:grid-cols-3 small:gap-6"
      >
        {cards.map((collection) => (
          <LocalizedClientLink
            key={collection.id}
            href={`/collections/${collection.handle}`}
            className="group relative block aspect-[4/5] overflow-hidden bg-gray-900"
          >
            <Image
              src="/images/veon-placeholder.jpg"
              alt={collection.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-center opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
              <span className="font-heading text-2xl font-bold uppercase tracking-tight text-white">
                {collection.title}
              </span>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 text-white transition-all duration-300 group-hover:bg-brand group-hover:border-brand"
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M7 17 17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </span>
            </div>
          </LocalizedClientLink>
        ))}
      </ScrollReveal>
    </section>
  )
}
