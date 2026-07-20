# Veon Homepage — Implementation Notes

Single-scroll Veon-style homepage for the 10shirts storefront (Next.js 15 + Medusa v2).
The homepage is now the shop: hero → categories → featured → new arrivals → best
sellers → collection features → best products → promo → newsletter.

All hard constraints from the handoff are met: product data flows exclusively through
`src/lib/data/products.ts`, prices render via `getProductPrice` (which wraps
`convertToLocale()`), every link is a `LocalizedClientLink`, `"use client"` appears only
where required (smooth scroll, nav wrapper, scroll reveal, newsletter form), fonts and
brand colors are untouched, the backend is untouched, and one shared placeholder image
(`public/images/veon-placeholder.jpg`) is used everywhere an image is needed.

---

## How to apply

1. Copy the contents of this folder over your repo root
   (`d:\web-dev-dani\10shirt\next\nextjs-starter-medusa`), preserving paths.
   Files listed under **Modified** below overwrite existing files; everything else is new.
2. Run the cleanup script from the repo root (deletes the old `/store` route safely):
   - Windows PowerShell: `powershell -ExecutionPolicy Bypass -File .\cleanup.ps1`
   - bash / Git Bash / WSL: `bash CLEANUP.sh`
3. `yarn install` (adds the `lenis` package).
4. `yarn dev` and run through the verification list at the bottom.

## New files

| Path | Purpose |
|---|---|
| `src/modules/home/components/smooth-scroll.tsx` | Client component that mounts Lenis on the homepage only. Skips modals/drawers via a `prevent` callback (`[data-lenis-prevent]`, dialogs, Headless UI portals), respects `prefers-reduced-motion`, and smooth-scrolls same-page `#` anchors with a −80px nav offset. Renders `null`. |
| `src/modules/home/components/section-heading/index.tsx` | Veon-style section heading: title + decorative line + optional CTA link. |
| `src/modules/home/components/veon-product-card/index.tsx` | Product card with hover image scale, optional badge (e.g. "Best Seller"), sale strikethrough pricing via `getProductPrice`, `data-testid="product-wrapper"`. |
| `src/modules/layout/templates/nav/nav-wrapper.tsx` | Client wrapper providing transparent→solid nav behavior (homepage only, see Deviations). Exposes state via a `data-nav` attribute + `group` class so the server-rendered nav children restyle with `group-data-[nav=transparent]:*` utilities. |
| `src/modules/home/components/category-cards/index.tsx` | `id="shop"` anchor target. 3-column collection cards (4:5 ratio, gradient overlay, arrow affordance) linking to `/collections/{handle}`. Renders an empty `#shop` anchor if no collections exist so the nav link never dangles. |
| `src/modules/home/components/best-sellers/index.tsx` | 3-column grid with "Best Seller" badges. |
| `src/modules/home/components/collection-features/index.tsx` | Two alternating image/text blocks highlighting the first two Medusa collections, sliding in from left/right. |
| `src/modules/home/components/best-products/index.tsx` | "Our Best Products" — wider 2-column cards (4:3 ratio) with a scale reveal. |
| `src/modules/home/components/promo-banner/index.tsx` | Full-width banner ("The Drop Won't Wait") with CTA to `#shop`. |
| `public/images/veon-placeholder.jpg` | The single shared placeholder (dark charcoal gradient, works under white text). Swap this one file to change every hero/category/feature/promo image at once. |

## Modified files

| Path | What changed |
|---|---|
| `src/app/[countryCode]/(main)/page.tsx` | Full rewrite. Orchestrates all data fetching in one `Promise.all`: collections, a shared pool of the 24 newest products, an optional curated `featured` collection, and best sellers. Sections receive slices of the pool (see Data strategy). Metadata still uses `t("meta.home.*")`. |
| `src/modules/layout/templates/nav/index.tsx` | Veon nav layout: SideMenu + logo left, centered "Shop" (`/#shop`) + About links, account icon + cart right. Styled for both transparent and solid states via `group-data` variants; logo turns white on the transparent state via a CSS filter. |
| `src/modules/home/components/hero/index.tsx` | Rewritten as a **server** component: full-viewport hero, dark overlay, staggered word reveal done in pure CSS (inline `@keyframes`, reduced-motion fallback), two CTAs to `#shop`, scroll indicator. |
| `src/modules/home/components/featured-products/index.tsx` | Rewritten: now takes a `products` prop and renders a 3-column staggered grid. The old signature (collections → ProductRail) is gone, which orphans `product-rail` (cleanup script removes it after checking for other importers). |
| `src/modules/home/components/new-in-grid/index.tsx` | Rewritten to the same pattern, "New Arrivals" heading. |
| `src/modules/home/components/newsletter/index.tsx` | Restyle only — identical fetch to `/store/newsletter/subscribe` with the publishable key header, same state machine and `t("home.newsletter.*")` keys. Veon centered layout, pill inputs with `sr-only` labels. |
| `src/modules/common/components/scroll-reveal/index.tsx` | Extended: `direction` (up/down/left/right/none — the direction content slides *from*), `delay`, `scale`, and `stagger` (wraps each child with an incremental transition delay). IntersectionObserver + CSS transitions only; fires once; instant-visible under reduced motion. Backwards compatible with the old delay-only API. |
| `src/lib/data/products.ts` | Two additions at the end of the file: `listProductsByCollection({ handle, countryCode, regionId, limit })` and `listBestSellers({ countryCode, regionId, limit })`. Nothing existing was changed. |
| `src/middleware.ts` | Added a redirect: `/store` and `/{countryCode}/store` → the country-code homepage (307). Inserted after the country-code resolution so it reuses the existing region logic. |
| `src/modules/products/components/product-preview/index.tsx` | Minimal change: thumbnail wrapped in an `overflow-hidden` div with a hover scale on the inner image, so collection/category pages get the same Veon hover feel. QuickAddButton and pricing untouched. |
| `package.json` | Added `"lenis": "^1.1.18"`. |

## Data strategy

One request fetches a pool of the 24 newest products; sections take slices:

- **Featured** — products from a collection with handle `featured` if it exists, else the first 3 of the pool.
- **New Arrivals** — pool slice 0–6 (already sorted `-created_at`).
- **Best Sellers** — `listBestSellers()`: products from a `best-sellers` collection handle if present, else products tagged `best seller` / `best-seller` / `bestseller` (case-insensitive), else a pool fallback. Create either the collection or the tag in Medusa Admin to curate this section — no code change needed.
- **Our Best Products** — pool slice 12–16 with fallback.

## Deliberate deviations from PROPOSAL.md

1. **`lenis` instead of `@studio-freight/lenis`.** The scoped package is deprecated; `lenis` is the maintained continuation with the same API.
2. **Lenis mounts from the homepage, not the layout.** Guarantees smooth scroll can never interfere with product/cart/checkout/account pages (constraint 8) and plays safe with the CartDrawer.
3. **Nav transparency is homepage-only.** Detected via `usePathname` (path is just the country code). Every other page keeps the solid sticky nav it has today. The wrapper uses a `sticky` header with a negative margin equal to its height so the hero starts under it; threshold for going solid is 80% of the viewport height.
4. **Page-level data orchestration** instead of each section fetching its own data — fewer requests, one loading boundary, easy to reshuffle sections.
5. **Hero is a server component.** The proposal suggested a client component for the entrance animation; pure CSS keyframes achieve it with zero JS.
6. **Surgical store cleanup instead of deleting `src/modules/store/` wholesale.** `src/lib/data/products.ts` imports `SortOptions` from `@modules/store/components/refinement-list/sort-products`, and the collections/categories templates share `paginated-products` from the store templates. Deleting the whole directory would break the build. The cleanup scripts delete only the route and the truly orphaned files, and verify with a reference check before each deletion.

## Things intentionally left alone (and why)

- **Footer** — the proposal marks restyling optional. The footer is rendered from the root layout, which isn't in the handoff, so it was left untouched rather than risk a blind edit.
- **SideMenu** — its source isn't in the handoff. If it still contains a "Store" link, the middleware redirect makes it land on the homepage harmlessly. Recommended follow-up: change that entry to "Shop" → `/#shop`.
- **i18n for new copy** — the `@lib/i18n` source isn't in the handoff, so new Veon copy ("New Arrivals", "Best Sellers", hero text, etc.) uses English literals. Existing keys were kept wherever semantics didn't change (`nav.about`, `nav.brand`, `meta.home.*`, all `home.newsletter.*`). Extracting the new strings to `t()` keys is a mechanical follow-up once you decide on key names.

## Known edge cases

- **CartMismatchBanner** (shown only for logged-in users with a cart/customer mismatch) would render underneath the transparent nav on the homepage due to the negative-margin trick. Rare state, cosmetic only, self-resolves once the banner action is taken.
- The regex in `listBestSellers` matches tag values, which are already included in the `fields` string used by `listProducts` — no extra request.

## Verification checklist (from the handoff)

1. `yarn dev` — homepage loads, all sections render (with placeholder imagery).
2. Scroll — Lenis smooth scrolling + staggered reveal animations; "Shop" in the nav glides to the category cards.
3. Click any product card — existing product detail page opens.
4. Add to cart → checkout — untouched flow, still works (Lenis is not mounted there).
5. Visit `/store` or `/dk/store` — 307 redirect to the homepage.
6. Nav — transparent over the hero (white logo/links), solid white + blur + shadow after scrolling ~80% of the viewport; solid everywhere else in the site.

TypeScript was checked in isolation against all new/modified files (React 18 types, bundler resolution): clean, apart from a pre-existing `next` property on `fetch` options in the original middleware code, which type-checks fine inside the real repo because Next.js augments the fetch types.
