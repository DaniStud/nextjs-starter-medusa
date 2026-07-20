import { Metadata } from "next"

import { listCollections } from "@lib/data/collections"
import {
  listBestSellers,
  listProducts,
  listProductsByCollection,
} from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { t } from "@lib/i18n"

import SmoothScroll from "@modules/home/components/smooth-scroll"
import Hero from "@modules/home/components/hero"
import CategoryCards from "@modules/home/components/category-cards"
import FeaturedProducts from "@modules/home/components/featured-products"
import NewInGrid from "@modules/home/components/new-in-grid"
import BestSellers from "@modules/home/components/best-sellers"
import CollectionFeatures from "@modules/home/components/collection-features"
import BestProducts from "@modules/home/components/best-products"
import PromoBanner from "@modules/home/components/promo-banner"
import Newsletter from "@modules/home/components/newsletter"

export const metadata: Metadata = {
  title: t("meta.home.title"),
  description: t("meta.home.description"),
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // One shared pool of the newest products feeds most sections — a single
  // cached request instead of one per section.
  const [collectionsResult, poolResult, featuredResult, bestSellerProducts] =
    await Promise.all([
      listCollections({ fields: "id, handle, title" }),
      listProducts({
        countryCode,
        queryParams: { limit: 24, order: "-created_at" },
      }),
      // Curated "featured" collection (optional — falls back to the pool)
      listProductsByCollection({
        handle: "featured",
        countryCode,
        limit: 3,
      }).catch(() => ({ products: [], count: 0, collection: null })),
      // Curated "best-sellers" collection or "best-seller" tags (optional)
      listBestSellers({ countryCode, limit: 6 }).catch(
        () => [] as Awaited<ReturnType<typeof listBestSellers>>
      ),
    ])

  const collections = collectionsResult?.collections ?? []
  const pool = poolResult.response.products

  // Distribute the pool across sections, preferring curated sources.
  const featured =
    featuredResult.products.length > 0
      ? featuredResult.products
      : pool.slice(0, 3)

  const newArrivals = pool.slice(0, 6)

  const bestSellers =
    bestSellerProducts.length > 0
      ? bestSellerProducts
      : pool.slice(6, 12).length > 0
      ? pool.slice(6, 12)
      : pool.slice(0, 6)

  const bestProducts =
    pool.slice(12, 16).length > 0 ? pool.slice(12, 16) : pool.slice(0, 4)

  return (
    <>
      {/* Lenis smooth scrolling — homepage only, respects reduced motion */}
      <SmoothScroll />

      {/* 1. Hero — full viewport, dark overlay, CTAs down to #shop */}
      <Hero />

      {/* 2. Category cards (carries the #shop anchor) */}
      <CategoryCards collections={collections} />

      {/* 3. Featured products */}
      <FeaturedProducts products={featured} />

      {/* 4. New arrivals */}
      <NewInGrid products={newArrivals} />

      {/* 5. Best sellers */}
      <BestSellers products={bestSellers} />

      {/* 6. Alternating collection feature blocks */}
      <CollectionFeatures collections={collections} />

      {/* 7. Our best products — wider cards */}
      <BestProducts products={bestProducts} />

      {/* 8. Promotional banner */}
      <PromoBanner />

      {/* 9. Newsletter */}
      <Newsletter />
    </>
  )
}
