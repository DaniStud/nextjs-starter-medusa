"use client"

import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React, { useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url
  const hoverImage = images?.[1]?.url
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 bg-ui-bg-subtle !shadow-none !border-none rounded-large transition-shadow ease-in-out duration-150",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {initialImage ? (
        <>
          <Image
            src={initialImage}
            alt="Thumbnail"
            className={clx(
              "absolute inset-0 object-contain object-center transition-opacity duration-500 ease-in-out",
              isHovered && hoverImage ? "opacity-0" : "opacity-100"
            )}
            draggable={false}
            quality={50}
            sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
            fill
          />
          {hoverImage && (
            <Image
              src={hoverImage}
              alt="Thumbnail hover"
              className={clx(
                "absolute inset-0 object-contain object-center transition-opacity duration-500 ease-in-out",
                isHovered ? "opacity-100" : "opacity-0"
              )}
              draggable={false}
              quality={50}
              sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
              fill
            />
          )}
        </>
      ) : (
        <div className="w-full h-full absolute inset-0 flex items-center justify-center">
          <PlaceholderImage size={size === "small" ? 16 : 24} />
        </div>
      )}
    </Container>
  )
}

export default Thumbnail
