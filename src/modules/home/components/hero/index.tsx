"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { t } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parallaxRef.current
    if (!el) return

    let raf: number
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = el.parentElement!.getBoundingClientRect()
        const offset = -rect.top * 0.2
        el.style.transform = `translateY(${offset}px) scale(1.1)`
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="w-full flex flex-col items-center">
      <div className="mb-12 w-full max-w-[90vw] md:max-w-[66vw] mx-auto mt-16 min-h-[66vh] border-b border-ui-border-base flex flex-col small:flex-row small:grid small:grid-cols-2">
        {/* Left Column – Content Pane */}
        <div className="flex flex-col items-center justify-center p-8 bg-white min-h-[50vh] small:min-h-0">
          <h1 className="text-3xl small:text-5xl font-heading font-bold text-black mb-4 text-center tracking-tight">
            {t("home.hero.heading")}
          </h1>
          <p className="text-base text-gray-800 max-w-md text-center mb-8">
            {t("home.hero.body")}
          </p>
          <LocalizedClientLink href="/store">
            <button className="bg-brand text-white px-10 py-3 text-sm font-medium rounded-full hover:bg-brand-dark transition-colors">
              {t("home.hero.cta")}
            </button>
          </LocalizedClientLink>
        </div>

        {/* Right Column – Parallax Image Pane */}
        <div className="relative w-full overflow-hidden min-h-[50vh] small:min-h-0 max-h-[900px]">
          <div
            ref={parallaxRef}
            className="absolute inset-0 scale-110 will-change-transform"
          >
            <Image
              src="/images/panda-foto1.png"
              alt={t("home.hero.imageAlt")}
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero