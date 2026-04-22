import { Suspense } from "react"
import Image from "next/image"

import { t } from "@lib/i18n"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative h-16 mx-auto border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between w-full h-full text-small-regular">
          <div className="flex items-center gap-x-6 h-full">
            <div className="h-full">
              <SideMenu regions={regions} />
            </div>
            <LocalizedClientLink
              href="/store"
              className="hidden small:block text-[#ed1d27] font-medium text-sm uppercase tracking-wide hover:text-[#c4161f] transition-colors"
            >
              {t("nav.store")}
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/about"
              className="hidden small:block text-[#ed1d27] font-medium text-sm uppercase tracking-wide hover:text-[#c4161f] transition-colors"
            >
              {t("nav.about")}
            </LocalizedClientLink>
          </div>

          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className="flex items-center"
              data-testid="nav-store-link"
            >
              <Image
                src="/images/10shirt-logo.png"
                alt={t("nav.brand")}
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full justify-end">
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2"
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
      </header>
    </div>
  )
}
