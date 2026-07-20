import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Veon-style section heading: bold uppercase title, a decorative rule
 * filling the remaining space, and an optional "View all" style link.
 */
export default function SectionHeading({
  title,
  ctaLabel,
  ctaHref,
}: {
  title: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div className="flex items-center gap-5 small:gap-8 mb-10 small:mb-12">
      <h2 className="font-heading font-bold uppercase tracking-tight text-2xl small:text-4xl text-gray-900 whitespace-nowrap">
        {title}
      </h2>
      <div className="h-px flex-1 bg-gray-200" aria-hidden="true" />
      {ctaLabel && ctaHref && (
        <LocalizedClientLink
          href={ctaHref}
          className="text-xs small:text-sm font-medium uppercase tracking-widest text-gray-500 hover:text-brand transition-colors whitespace-nowrap"
        >
          {ctaLabel}
        </LocalizedClientLink>
      )}
    </div>
  )
}
