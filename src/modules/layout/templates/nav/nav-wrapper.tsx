"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * Client shell for the nav.
 *
 * Homepage (`/{countryCode}`):
 *   transparent over the full-viewport hero → solid white + backdrop-blur
 *   once the user scrolls past ~80% of the hero. A negative bottom margin
 *   (matching the h-20 header) lets the hero start at the very top of the
 *   viewport while the nav stays sticky above it.
 *
 * Every other page:
 *   permanently solid white sticky nav — identical to previous behavior,
 *   so product / cart / checkout / account pages are unaffected.
 *
 * The wrapper exposes the state via `data-nav="transparent|solid"` +
 * the `group` class, so server-rendered children restyle themselves with
 * `group-data-[nav=transparent]:*` utilities (no client re-render needed).
 */
export default function NavWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const segments = pathname?.split("/").filter(Boolean) ?? []
  // `/{countryCode}` (or `/`) → homepage
  const isHome = segments.length <= 1

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isHome) return

    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.8)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isHome])

  const transparent = isHome && !scrolled

  return (
    <div
      className={`sticky top-0 inset-x-0 z-50 group ${isHome ? "-mb-20" : ""}`}
      data-nav={transparent ? "transparent" : "solid"}
    >
      <header
        className={`relative h-20 mx-auto transition-all duration-300 ${
          transparent
            ? "bg-transparent border-b border-white/15"
            : "bg-white/90 backdrop-blur-md border-b border-ui-border-base shadow-sm"
        }`}
      >
        {children}
      </header>
    </div>
  )
}
