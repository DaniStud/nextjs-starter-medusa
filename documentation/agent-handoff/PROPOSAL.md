# Proposal: Implement Veon-Style Homepage Layout for 10shirts

## Context

We have a Next.js 15 + Medusa v2 e-commerce storefront ("10shirts") in `d:\web-dev-dani\10shirt\next\nextjs-starter-medusa`. A Framer website template called "Veon" lives at `documentation/export_veonn_framer_website/` — it's an exported static site. The goal is to **replace the current homepage entirely** with a Veon-style single-scroll page where all shop products appear as you scroll down (the homepage IS the shop), including the Veon template's animations and layout patterns. Backend (Medusa) must remain untouched — this is a frontend-only change. Keep existing fonts (Space Grotesk + Inter) and brand colors (brand red `#ed1d27`).

---

## Architecture Decision

**Animation library: Lenis (smooth scrolling) + extended CSS/Intersection Observer**

- **Lenis** (~5KB) provides the silky smooth scrolling feel the Veon template has
- **CSS Transitions + Intersection Observer** for fade-in/slide-up/slide-left/slide-right reveals on scroll — extending the existing `ScrollReveal` component already in the codebase
- Avoids heavy libraries like GSAP or Framer Motion

---

## Implementation Plan (4 Phases)

### Phase 1: Setup & Infrastructure
1. **Install Lenis** — `yarn add @studio-freight/lenis`
2. **Create a `<SmoothScroll>` client component** — wraps the app layout, initializes and destroys Lenis
3. **Extend `<ScrollReveal>`** — add `direction` prop (`"up" | "left" | "right"`), `stagger` prop (delay between children), `scale` prop
4. **Add placeholder images** — copy a hero background image and category card images into `public/images/` (use the same image everywhere for now, or pull from Veon assets in `documentation/export_veonn_framer_website/_ext/framer-cdn/images/`)
5. **Extend data functions** — add `listProductsByCollection(handle)` and `listBestSellers()` to `src/lib/data/products.ts` to support the new sections

### Phase 2: Veon-Style Navigation
6. **Rewrite `src/modules/layout/templates/nav/index.tsx`** — transparent background at top of page → transitions to solid white with `backdrop-blur` when user scrolls past hero. Slim layout matching Veon: logo left, center links (Shop, About, Blogs, FAQ, Contact — link Shop to `#shop` anchor), right icons (search, favorites, cart). Keep the brand font (Space Grotesk) and brand red accents.

### Phase 3: Homepage Sections (top to bottom, all on one page)

7. **Hero Section** (`src/modules/home/components/hero/index.tsx`) — Full viewport height. Background image with dark overlay (`brightness(0.5)`). Centered text: large heading "LATEST CULTURE IS HERE" (Space Grotesk bold, ~72px desktop), subtext paragraph, two pill-shaped CTA buttons "SHOP MEN" and "SHOP WOMEN" linking to `#shop` section. Arrow/chevron down indicator at bottom.

8. **Category Cards** (new component `src/modules/home/components/category-cards/index.tsx`) — 3-column responsive grid of image cards. Each card: image with text overlay, links to a collection page or anchors to filtered product grid. Use placeholder images. Pull categories from Medusa collections data.

9. **Featured Products** (`src/modules/home/components/featured-products/index.tsx`) — Section heading "FEATURED" with a line. 3-column grid of product cards. Each card reuses the existing `ProductPreview` component, restyled to Veon's card design (image on top, product name + price below, hover scale effect). Products come from a "featured" collection or just the first N products from Medusa.

10. **New Arrivals** (`src/modules/home/components/new-in-grid/index.tsx`) — Section heading "NEW ARRIVALS" with a line. 3-column grid same as Featured Products but populated with most recently created products from Medusa.

11. **Best Sellers** (new component `src/modules/home/components/best-sellers/index.tsx`) — Section heading "BEST SELLERS" with a line. 3-column product grid. Pull the most popular/recent products from Medusa.

12. **Collection Feature Blocks** (new component `src/modules/home/components/collection-features/index.tsx`) — 2 alternating full-width sections. Each: one side has a large image, the other has text (collection name, description, "SHOP NOW" CTA). Pull 2 collections from Medusa. On mobile, stack vertically.

13. **"Our Best Products"** (new component `src/modules/home/components/best-products/index.tsx`) — Section heading "OUR BEST PRODUCTS". Wider product cards in a 3-column grid. Pull different products from Medusa (or re-use with different sorting).

14. **Promotional Banner** (new component `src/modules/home/components/promo-banner/index.tsx`) — Full-width image with dark overlay. Centered text + CTA button. Use a placeholder image.

15. **Newsletter** (`src/modules/home/components/newsletter/index.tsx`) — Keep existing component, restyle to match Veon's minimal footer-newsletter look.

### Phase 4: Cleanup & Routing
16. **Remove the `/store` page** — Delete or archive `src/app/[countryCode]/(main)/store/` and `src/modules/store/`
17. **Update the homepage `page.tsx`** — `src/app/[countryCode]/(main)/page.tsx` assembles all sections in order
18. **Update middleware or redirects** — ensure `/store` requests redirect to the homepage
19. **Update Nav** — remove the "Store" link, replace with "Shop" anchor link
20. **Test the full flow** — homepage scroll → click product → product detail page → add to cart → checkout

---

## What Stays Unchanged
- **All Medusa backend** — zero changes
- **All data fetching** (`src/lib/data/*.ts`) — only additions, no deletions
- **Product detail page**, **cart**, **checkout**, **account**, **order pages** — untouched
- **Fonts**: Space Grotesk (`--font-heading`) + Inter (`--font-body`)
- **Brand colors**: `brand: #ed1d27`, `brand-dark: #c4161f`
- **Tailwind config**, **globals.css**, **CSP**, **middleware**, **cookie consent**

---

## Files Manifest

### Files to CREATE:
```
src/modules/home/components/smooth-scroll.tsx          # Lenis wrapper component
src/modules/home/components/category-cards/index.tsx   # Category image cards section
src/modules/home/components/best-sellers/index.tsx     # Best sellers product grid
src/modules/home/components/collection-features/index.tsx  # Alternating image+text blocks
src/modules/home/components/best-products/index.tsx    # "Our Best Products" grid
src/modules/home/components/promo-banner/index.tsx     # Full-width promotional banner
public/images/veon-hero-bg.jpg                         # Hero background placeholder
public/images/veon-category-1.jpg                      # Category card placeholder
public/images/veon-promo-bg.jpg                        # Promo banner placeholder
```

### Files to MODIFY:
```
src/app/[countryCode]/(main)/page.tsx                  # Assemble all sections in order
src/app/[countryCode]/(main)/layout.tsx                # Add SmoothScroll wrapper (or root layout)
src/modules/layout/templates/nav/index.tsx             # Rewrite to Veon-style nav
src/modules/home/components/hero/index.tsx             # Rewrite to full-viewport Veon hero
src/modules/home/components/featured-products/index.tsx # Adapt to section heading + 3-col grid
src/modules/home/components/new-in-grid/index.tsx      # Adapt to "NEW ARRIVALS" + 3-col grid
src/modules/home/components/newsletter/index.tsx       # Restyle to Veon footer style
src/modules/common/components/scroll-reveal/index.tsx  # Extend with direction/stagger/scale props
src/lib/data/products.ts                               # Add listBestSellers, listProductsByCollection
src/modules/products/components/product-preview/index.tsx  # Restyle card to Veon design (hover scale)
src/modules/layout/templates/footer/index.tsx          # Minor restyle (optional, keep existing)
package.json                                            # Add @studio-freight/lenis dependency
```

### Files to DELETE or ARCHIVE:
```
src/app/[countryCode]/(main)/store/                    # Entire store page route
src/modules/store/                                     # Store templates/components
```

### Files to READ for context (DO NOT MODIFY):
```
documentation/DOCUMENTATION.md                         # Full project docs
documentation/export_veonn_framer_website/index.html    # Veon template structure & styles
tailwind.config.js                                     # Custom colors, fonts, breakpoints
src/styles/globals.css                                 # Brand overrides, utility classes
src/lib/config.ts                                      # Medusa SDK configuration
src/lib/data/collections.ts                            # Collection data functions
src/lib/data/products.ts                               # Product data functions
src/lib/data/regions.ts                                # Region data functions
src/lib/constants.tsx                                  # Payment provider constants
src/types/global.ts                                    # TypeScript types
src/middleware.ts                                      # Region detection, country code routing
```

---

## Key Constraints

1. **All product data MUST come from Medusa** via `src/lib/data/products.ts` — never hardcoded
2. **All prices MUST use `convertToLocale()`** from `src/lib/util/money.ts`
3. **All links MUST use `LocalizedClientLink`** from `src/modules/common/components/localized-client-link` to preserve country-code routing
4. **Keep `"use client"` only on components that need it** — server components by default
5. **Use a single placeholder image** for hero, category cards, collection features, and promo banner — can swap for real images later
6. **Never change fonts** — Space Grotesk for headings, Inter for body
7. **Never change brand colors** — `#ed1d27` red, `#c4161f` dark red

---

## Visual Reference

Open `documentation/export_veonn_framer_website/index.html` in a browser to see the exact layout we're replicating. The relevant Framer CSS classes are:
- `framer-ShpJ4` — the main homepage component (hero, sticky product grid, sections)
- `framer-Yww0r` — hero section with full-viewport background
- `framer-vnDHa` — category cards grid
- `framer-k6XFx` — product grid sections with headings
- `framer-y5zoe` / `framer-P0NDy` — product cards
- `framer-66krX` — footer with newsletter

---

This is a complete, self-contained proposal. The agent should work through Phases 1→4 in order, committing after each phase.