import Image from "next/image"
import ScrollReveal from "@modules/common/components/scroll-reveal"

/**
 * Full-width promotional banner: image with dark overlay, centered
 * heading, subtext and a CTA back up to the shop sections.
 */
export default function PromoBanner() {
  return (
    <section className="relative h-[420px] w-full overflow-hidden small:h-[540px]">
      <Image
        src="/images/veon-placeholder.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <ScrollReveal>
          <span className="mb-4 block text-xs font-medium uppercase tracking-[0.25em] text-white/70">
            Limited Season Drop
          </span>
          <h2 className="mb-5 font-heading text-4xl font-bold uppercase tracking-tight text-white small:text-6xl">
            The Drop Won&apos;t Wait
          </h2>
          <p className="mx-auto mb-9 max-w-lg text-base text-white/85">
            Signature pieces in limited runs — once they&apos;re gone,
            they&apos;re gone.
          </p>
          <a
            href="#shop"
            className="inline-block rounded-full bg-brand px-10 py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-brand-dark"
          >
            Shop the Collection
          </a>
        </ScrollReveal>
      </div>
    </section>
  )
}
