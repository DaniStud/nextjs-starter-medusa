"use client"

import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import { t } from "@lib/i18n"
import Image from "next/image"
import { useState, useRef, useCallback } from "react"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const goTo = useCallback(
    (index: number) => {
      if (index < 0) setCurrent(images.length - 1)
      else if (index >= images.length) setCurrent(0)
      else setCurrent(index)
    },
    [images.length]
  )

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo(current + 1)
      else goTo(current - 1)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Main image with swipe support */}
      <div
        className="relative cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Container className="relative aspect-[29/34] md:aspect-[4/5] w-full overflow-hidden bg-ui-bg-subtle !shadow-none !border-none">
          {!!images[current]?.url && (
            <Image
              src={images[current].url}
              priority
              className="absolute inset-0 rounded-rounded"
              alt={t("imageGallery.productImage", { n: current + 1 })}
              fill
              sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc(66vw - 48px), calc(33vw - 48px)"
              style={{ objectFit: "cover" }}
            />
          )}
        </Container>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(current - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-none w-12 h-12 flex items-center justify-center text-ui-fg-base transition-colors text-xl"
              aria-label={t("imageGallery.prevImage")}
            >
              &#8249;
            </button>
            <button
              onClick={() => goTo(current + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-none w-12 h-12 flex items-center justify-center text-ui-fg-base transition-colors text-xl"
              aria-label={t("imageGallery.nextImage")}
            >
              &#8250;
            </button>
          </>
        )}

        {/* Indicator lines - overlaid at bottom of image */}
        {images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-x-2 py-4">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                aria-label={t("imageGallery.thumbnail", { n: index + 1 })}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  index === current
                    ? "w-8 bg-brand"
                    : "w-4 bg-stone-300 hover:bg-stone-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageGallery
