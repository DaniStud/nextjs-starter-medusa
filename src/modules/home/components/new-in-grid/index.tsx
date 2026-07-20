import { HttpTypes } from "@medusajs/types"
import ScrollReveal from "@modules/common/components/scroll-reveal"
import SectionHeading from "@modules/home/components/section-heading"
import VeonProductCard from "@modules/home/components/veon-product-card"

/**
 * "NEW ARRIVALS" — the most recently created products from Medusa in a
 * Veon-style 3-column grid. The page fetches the newest products
 * (`order: "-created_at"`) and passes them in.
 */
export default function NewInGrid({
  products,
}: {
  products: HttpTypes.StoreProduct[]
}) {
  if (!products || products.length === 0) {
    return null
  }

  return (
    <section className="mx-auto w-full max-w-[92rem] px-5 py-16 small:px-10 small:py-24">
      <ScrollReveal>
        <SectionHeading title="New Arrivals" />
      </ScrollReveal>

      <ScrollReveal
        stagger={120}
        className="grid grid-cols-1 gap-x-6 gap-y-10 xsmall:grid-cols-2 small:grid-cols-3"
      >
        {products.map((product) => (
          <VeonProductCard key={product.id} product={product} />
        ))}
      </ScrollReveal>
    </section>
  )
}
