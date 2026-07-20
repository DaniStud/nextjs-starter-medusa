import { HttpTypes } from "@medusajs/types"
import ScrollReveal from "@modules/common/components/scroll-reveal"
import SectionHeading from "@modules/home/components/section-heading"
import VeonProductCard from "@modules/home/components/veon-product-card"

/**
 * "OUR BEST PRODUCTS" — wider product cards in a 2-column grid
 * (landscape 4:3 imagery instead of the portrait 3:4 grid cards).
 */
export default function BestProducts({
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
        <SectionHeading title="Our Best Products" />
      </ScrollReveal>

      <ScrollReveal
        stagger={140}
        scale
        className="grid grid-cols-1 gap-x-8 gap-y-12 small:grid-cols-2"
      >
        {products.map((product) => (
          <VeonProductCard
            key={product.id}
            product={product}
            aspectClassName="aspect-[4/3]"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ))}
      </ScrollReveal>
    </section>
  )
}
