"use client"

import { useEffect } from "react"
import Lenis from "lenis"

/**
 * SmoothScroll — initializes Lenis smooth scrolling for the page it is
 * mounted on. Rendered from the homepage only (not the layout) so that
 * product, cart, checkout and account pages keep 100% native scrolling
 * and cannot be affected by Lenis in any way.
 *
 * - Respects `prefers-reduced-motion`.
 * - Skips (does not hijack) wheel/touch events inside dialogs, drawers and
 *   any element marked with `data-lenis-prevent` (e.g. the cart drawer,
 *   Headless UI portals), so nested scroll containers keep working.
 * - Smooth-scrolls same-page anchor links (e.g. the nav "Shop" link and
 *   the hero CTAs pointing at `#shop`) with an offset for the fixed nav.
 */
export default function SmoothScroll() {
  useEffect(() => {
    // Respect users who prefer reduced motion — plain native scrolling.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      // Never hijack scrolling inside overlays / nested scroll areas.
      prevent: (node: HTMLElement | null) =>
        !!node?.closest?.(
          '[data-lenis-prevent], [role="dialog"], [data-headlessui-portal], [aria-modal="true"]'
        ),
    })

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // Smooth anchor scrolling for same-page hash links (#shop etc.)
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.(
        "a[href*='#']"
      ) as HTMLAnchorElement | null

      if (!anchor) return

      const url = new URL(anchor.href, window.location.href)

      if (
        !url.hash ||
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname
      ) {
        return
      }

      const target = document.querySelector(url.hash)
      if (!target) return

      e.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: -80 })
    }

    document.addEventListener("click", onClick)

    return () => {
      document.removeEventListener("click", onClick)
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}
