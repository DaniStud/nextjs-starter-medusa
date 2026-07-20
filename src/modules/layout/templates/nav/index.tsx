import { Suspense } from "react"
import Image from "next/image"

import { t } from "@lib/i18n"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

import NavWrapper from "./nav-wrapper"

export default async function Nav() {
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)

  return (
    <NavWrapper>
      <nav className="relative flex h-full w-full items-center justify-between px-5 small:px-10 text-small-regular text-gray-900 transition-colors duration-300 group-data-[nav=transparent]:text-white">
        {/* Left — side menu (mobile/regions) + logo */}
        <div className="flex h-full items-center gap-x-4">
          <div className="h-full group-data-[nav=transparent]:text-white">
            <SideMenu regions={regions} />
          </div>
          <LocalizedClientLink
            href="/"
            className="flex items-center"
            data-testid="nav-store-link"
          >
            <Image
              src={
                process.env.NEXT_PUBLIC_LOGO_URL || "/images/10shirt-logo.png"
              }
              alt={t("nav.brand")}
              width={400}
              height={100}
              className="h-12 w-auto object-contain transition-[filter] duration-300 group-data-[nav=transparent]:brightness-0 group-data-[nav=transparent]:invert"
              priority
            />
          </LocalizedClientLink>
        </div>

        {/* Center — links (desktop) */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-x-10 small:flex">
          <LocalizedClientLink
            href="/#shop"
            className="text-sm font-medium uppercase tracking-widest transition-colors hover:text-brand"
          >
            Shop
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/about"
            className="text-sm font-medium uppercase tracking-widest transition-colors hover:text-brand"
          >
            {t("nav.about")}
          </LocalizedClientLink>
        </div>

        {/* Right — account + cart */}
        <div className="flex h-full items-center justify-end gap-x-5">
          <LocalizedClientLink
            href="/account"
            className="hidden small:flex items-center transition-colors hover:text-brand"
            aria-label="Account"
            data-testid="nav-account-link"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </LocalizedClientLink>

          <Suspense
            fallback={
              <LocalizedClientLink
                className="flex gap-2 transition-colors hover:text-brand"
                href="/cart"
                data-testid="nav-cart-link"
              >
                {t("nav.cart", { count: 0 })}
              </LocalizedClientLink>
            }
          >
            <CartButton />
          </Suspense>
        </div>
      </nav>
    </NavWrapper>
  )
}
