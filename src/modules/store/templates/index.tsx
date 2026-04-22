import { Suspense } from "react"
import { t } from "@lib/i18n"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div
      className="flex flex-col py-6 content-container min-w-[90%]"
      data-testid="category-container"
    >
      <div className="flex flex-row items-center justify-between w-full mb-8">
        <div className="text-2xl-semi">
          <h1 data-testid="store-page-title">{t("store.allProducts")}</h1>
        </div>
        {/* RefinementList (Sort by) has been removed from here */}
      </div>

      <div className="w-full">
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default StoreTemplate  