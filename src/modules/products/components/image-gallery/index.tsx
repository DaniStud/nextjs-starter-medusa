"use client"

import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import { t } from "@lib/i18n"
import Image from "next/image"
import { useState } from "react"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((i) => (i === 0 ? images.length - 1 : i - 1))
  const next = () => setCurrent((i) => (i === images.length - 1 ? 0 : i + 1))

  return (
    <div className="flex flex-col gap-y-4">
      {/* Main image */}
      <div className="relative">
        <Container className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle">
          {!!images[current]?.url && (
            <Image
              src={images[current].url}
              priority
              className="absolute inset-0 rounded-rounded"
              alt={t("imageGallery.productImage", { n: current + 1 })}
              fill
              sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
              style={{ objectFit: "cover" }}
            />
          )}
        </Container>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-ui-fg-base"
              aria-label={t("imageGallery.prevImage")}
            >
              &#8249;
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-ui-fg-base"
              aria-label={t("imageGallery.nextImage")}
            >
              &#8250;
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-x-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setCurrent(index)}
              className={`relative w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 ${
                index === current
                  ? "border-ui-fg-base"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  alt={t("imageGallery.thumbnail", { n: index + 1 })}
                  fill
                  sizes="64px"
                  style={{ objectFit: "cover" }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
