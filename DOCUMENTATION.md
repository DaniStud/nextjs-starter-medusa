# 10shirts — Full-Stack E-Commerce Platform

## Comprehensive Technical Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Frontend (Next.js Storefront)](#5-frontend-nextjs-storefront)
   - [Routing](#51-routing)
   - [Middleware](#52-middleware)
   - [Data Layer (Server Actions)](#53-data-layer-server-actions)
   - [Modules / Components](#54-modules--components)
   - [Hooks & Context](#55-hooks--context)
   - [Utilities](#56-utilities)
   - [Types](#57-types)
   - [Styling](#58-styling)
   - [Cookie Consent](#59-cookie-consent)
6. [Backend (Medusa v2)](#6-backend-medusa-v2)
   - [Configuration](#61-configuration)
   - [API Routes](#62-api-routes)
   - [Stripe Webhook Handler](#63-stripe-webhook-handler)
   - [Subscribers](#64-subscribers)
   - [Seed Script](#65-seed-script)
7. [Payment Integration (Stripe)](#7-payment-integration-stripe)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
   - [Docker (Local Development)](#81-docker-local-development)
   - [Railway (Production Deployment)](#82-railway-production-deployment)
9. [Environment Variables](#9-environment-variables)
10. [Development Guide](#10-development-guide)
11. [Testing](#11-testing)
12. [Security Considerations](#12-security-considerations)

---

## 1. Project Overview

**10shirts** is a full-stack e-commerce storefront built on the **Medusa v2** headless commerce engine with a **Next.js 15** frontend. The platform supports:

- Product browsing with categories and collections
- Shopping cart with persistent state
- Multi-step checkout with Stripe payment processing (including 3D Secure)
- Customer accounts with order history and address management
- Multi-region/multi-currency support (EUR, USD)
- Free shipping promotions and discount codes
- Cookie consent management (GDPR-ready)
- SEO-optimized sitemap generation

---

## 2. Architecture

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│   Next.js 15 Storefront         │     │   Medusa v2 Backend             │
│   (port 8000)                   │     │   (port 9000)                   │
│                                 │     │                                 │
│  ┌──────────┐  ┌──────────┐    │     │  ┌──────────┐  ┌──────────┐   │
│  │ App      │  │ Server   │    │────▶│  │ Store    │  │ Admin    │   │
│  │ Router   │  │ Actions  │    │ SDK │  │ API      │  │ API      │   │
│  └──────────┘  └──────────┘    │     │  └──────────┘  └──────────┘   │
│                                 │     │                                 │
│  ┌──────────┐  ┌──────────┐    │     │  ┌──────────┐  ┌──────────┐   │
│  │ Stripe   │  │ Tailwind │    │     │  │ Stripe   │  │ Payment  │   │
│  │ Elements │  │ CSS      │    │     │  │ Provider │  │ Module   │   │
│  └──────────┘  └──────────┘    │     │  └──────────┘  └──────────┘   │
└─────────────────────────────────┘     └──────────┬──────────┬─────────┘
                                                    │          │
                                         ┌──────────▼──┐  ┌───▼────────┐
                                         │ PostgreSQL  │  │   Redis    │
                                         │ (port 5432) │  │ (port 6379)│
                                         └─────────────┘  └────────────┘
```

**Communication flow:**
1. The Next.js storefront communicates with Medusa via the `@medusajs/js-sdk` (REST API calls)
2. Server Actions in `src/lib/data/` execute on the server and call the Medusa Store API
3. Stripe payment processing uses client-side Stripe Elements for PCI compliance
4. Stripe webhooks are received by a custom API route on the Medusa backend

---

## 3. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.5.9 | React framework (App Router, Server Components, Turbopack) |
| React | 19.0.0-rc | UI library |
| TypeScript | 5.3+ | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| `@medusajs/js-sdk` | 2.13.1 | Medusa API client |
| `@medusajs/ui` | 4.1.1 | Medusa design system components |
| `@stripe/react-stripe-js` | 5.6.1 | Stripe payment elements |
| `@stripe/stripe-js` | 8.9.0 | Stripe.js SDK |
| `@headlessui/react` | 2.2.0 | Accessible UI primitives |
| `@radix-ui/react-accordion` | 1.2.1 | Accordion component |
| `vanilla-cookieconsent` | 3.1.0 | GDPR cookie consent |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Medusa | 2.13.1 | Headless commerce engine |
| `@medusajs/payment-stripe` | 2.13.1 | Stripe payment provider |
| PostgreSQL | 15 | Primary database |
| Redis | Latest | Cache & session store |
| MikroORM | 6.4.16 | ORM (PostgreSQL adapter) |
| Node.js | ≥20 | Runtime |

---

## 4. Project Structure

```
nextjs-starter-medusa/
├── src/                              # Next.js frontend source
│   ├── app/                          # App Router pages & layouts
│   │   ├── layout.tsx                # Root layout (Cookie Consent + Footer)
│   │   ├── not-found.tsx             # 404 page
│   │   └── [countryCode]/            # Dynamic country-based routing
│   │       ├── (checkout)/           # Checkout route group
│   │       └── (main)/              # Main storefront route group
│   ├── lib/                          # Shared libraries
│   │   ├── config.ts                 # Medusa SDK initialization
│   │   ├── constants.tsx             # Payment provider maps, currency helpers
│   │   ├── context/                  # React contexts (Modal)
│   │   ├── data/                     # Server Actions (API calls)
│   │   ├── hooks/                    # Custom React hooks
│   │   └── util/                     # Utility functions
│   ├── modules/                      # Feature modules (components + templates)
│   │   ├── account/                  # Customer account pages
│   │   ├── cart/                     # Shopping cart
│   │   ├── categories/               # Product categories
│   │   ├── checkout/                 # Checkout flow
│   │   ├── collections/              # Product collections
│   │   ├── common/                   # Shared UI components
│   │   ├── home/                     # Homepage components
│   │   ├── layout/                   # Nav, Footer, Side Menu
│   │   ├── order/                    # Order confirmation & details
│   │   ├── products/                 # Product display components
│   │   ├── shipping/                 # Shipping/delivery UI
│   │   ├── skeletons/                # Loading skeleton components
│   │   └── store/                    # Store listing page
│   ├── styles/                       # Global CSS
│   ├── types/                        # TypeScript type definitions
│   ├── middleware.ts                  # Edge middleware (region detection, redirects)
│   └── cookieConsent.tsx             # GDPR cookie consent banner
├── public/                           # Static assets
│   └── images/                       # Image assets
├── medusa-backend/                   # Backend services
│   ├── docker-compose.yml            # PostgreSQL + Redis containers
│   └── my-medusa-store/              # Medusa application
│       ├── medusa-config.ts          # Medusa configuration
│       ├── package.json              # Backend dependencies
│       ├── railway.toml              # Railway deployment config
│       └── src/
│           ├── api/                  # Custom API routes
│           │   ├── store/custom/     # Store API extensions
│           │   ├── admin/custom/     # Admin API extensions
│           │   └── stripe/           # Stripe webhook handler
│           ├── subscribers/          # Event subscribers
│           ├── scripts/              # CLI scripts (seed)
│           ├── admin/                # Admin UI extensions (empty)
│           ├── modules/              # Custom modules (empty)
│           ├── workflows/            # Custom workflows (empty)
│           ├── jobs/                 # Scheduled jobs (empty)
│           └── links/                # Module links (empty)
├── package.json                      # Frontend dependencies
├── next.config.js                    # Next.js configuration + CSP
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── next-sitemap.js                   # Sitemap generation config
├── postcss.config.js                 # PostCSS configuration
└── check-env-variables.js            # Build-time env validation
```

---

## 5. Frontend (Next.js Storefront)

### 5.1 Routing

The app uses Next.js 15 App Router with **country code-based routing**. Every storefront URL is prefixed with a country code (e.g., `/us/`, `/gb/`, `/de/`).

#### Route Groups

| Route Group | Purpose | Layout Features |
|---|---|---|
| `(main)` | Main storefront pages | Nav bar, Cart button, Free shipping nudge, Cart mismatch banner |
| `(checkout)` | Checkout flow | Minimal nav with "Back to cart" link |

#### Pages

| Route | Component | Description |
|---|---|---|
| `/[countryCode]/` | `(main)/page.tsx` | Homepage with Hero + Featured Products |
| `/[countryCode]/store` | `(main)/store/page.tsx` | Product catalog with sorting/pagination |
| `/[countryCode]/products/[handle]` | `(main)/products/[handle]/page.tsx` | Product detail page |
| `/[countryCode]/categories/[...category]` | `(main)/categories/[...category]/page.tsx` | Category listing (supports nested categories) |
| `/[countryCode]/collections/[handle]` | `(main)/collections/[handle]/page.tsx` | Collection listing |
| `/[countryCode]/cart` | `(main)/cart/page.tsx` | Shopping cart |
| `/[countryCode]/account` | `(main)/account/layout.tsx` | Customer account (parallel routes: `@dashboard` / `@login`) |
| `/[countryCode]/order/[id]` | `(main)/order/[id]/page.tsx` | Order details & confirmation |
| `/[countryCode]/checkout` | `(checkout)/checkout/page.tsx` | Multi-step checkout |

#### Parallel Routes (Account)

The account section uses Next.js **parallel routes**:
- `@login` — Displayed when the customer is not authenticated (login/register forms)
- `@dashboard` — Displayed when authenticated (profile, orders, addresses)

### 5.2 Middleware

**File:** `src/middleware.ts` (runs on Edge Runtime)

The middleware handles:

1. **Region Detection** — Fetches Medusa `/store/regions` and builds a `countryCode → Region` map (cached 1 hour in-memory + HTTP cache with `revalidate: 3600`)
2. **Country Code Resolution** — Priority order:
   1. URL path segment (e.g., `/us/store`)
   2. Vercel `x-vercel-ip-country` header (geo-IP in production)
   3. `NEXT_PUBLIC_DEFAULT_REGION` env var
   4. First available region (fallback)
3. **Path Rewriting** — Redirects bare paths to `/{countryCode}/...` (307 redirect)
4. **Cache Scoping** — Sets `_medusa_cache_id` cookie (24h) for per-session Next.js cache tag scoping

#### Cookies Managed

| Cookie | Purpose | Lifetime |
|---|---|---|
| `_medusa_cache_id` | Scopes Next.js cache tags per-user session | 24 hours |
| `_medusa_jwt` | Authentication token (set by login) | 7 days |
| `_medusa_cart_id` | Active cart identifier | 7 days |
| `cookie_consent` | GDPR consent preferences | 365 days |

### 5.3 Data Layer (Server Actions)

All data fetching is performed via **Server Actions** (`"use server"` directive) in `src/lib/data/`. These use the `@medusajs/js-sdk` instance configured in `src/lib/config.ts`.

#### Medusa SDK Configuration

```typescript
// src/lib/config.ts
const sdk = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
```

#### Cart Actions (`src/lib/data/cart.ts`)

| Function | Description |
|---|---|
| `retrieveCart(cartId?, fields?)` | Fetches cart by ID with full item/region/promotion data (force-cached) |
| `getOrSetCart(countryCode)` | Creates new cart or retrieves existing; updates region on country change |
| `updateCart(data)` | Patches cart (e.g., email, metadata) |
| `addToCart({ variantId, quantity, countryCode })` | Adds a line item to cart |
| `updateLineItem({ lineId, quantity })` | Updates a line item's quantity |
| `deleteLineItem(lineId)` | Removes a line item |
| `setShippingMethod({ cartId, shippingMethodId })` | Sets shipping method on cart |
| `initiatePaymentSession(cart, data)` | Creates a payment session (Stripe/PayPal/Manual) |
| `applyPromotions(codes[])` | Applies promotion codes to cart |
| `setAddresses(state, formData)` | Sets shipping & billing addresses, advances to delivery step |
| `placeOrder(cartId?)` | Completes cart → creates order |
| `listCartOptions()` | Lists available shipping options for the cart |

#### Customer Actions (`src/lib/data/customer.ts`)

| Function | Description |
|---|---|
| `retrieveCustomer()` | Fetches authenticated customer profile |
| `updateCustomer(body)` | Updates customer profile fields |
| `signup(state, formData)` | Registers new customer + auto-login |
| `login(state, formData)` | Authenticates customer (emailpass provider) |
| `signout(countryCode)` | Logs out + removes auth token |
| `addCustomerAddress(state, formData)` | Adds a shipping address |
| `updateCustomerAddress(state, formData)` | Updates an existing address |
| `deleteCustomerAddress(id)` | Deletes an address |
| `transferCart()` | Links anonymous cart to customer after login |

#### Product Queries (`src/lib/data/products.ts`)

| Function | Description |
|---|---|
| `listProducts(...)` | Paginated product list with calculated prices and inventory |
| `listProductsWithSort(...)` | Fetches products with client-side sorting (price ASC/DESC, newest) |
| `getProductByHandle(handle, regionId)` | Single product lookup by URL handle |
| `getProductsList(...)` | Alias for `listProducts` |

#### Order Actions (`src/lib/data/orders.ts`)

| Function | Description |
|---|---|
| `retrieveOrder(id)` | Fetches order by ID with payment collections, items, variants |
| `listOrders(limit, offset, filters)` | Lists customer's orders (paginated) |
| `createTransferRequest(state, formData)` | Requests order ownership transfer |
| `acceptTransferRequest(id, token)` | Accepts a pending transfer |
| `declineTransferRequest(id, token)` | Declines a pending transfer |

#### Other Data Modules

| File | Key Functions |
|---|---|
| `payment.ts` | `listCartPaymentMethods(regionId)` — fetches available payment providers |
| `fulfillment.ts` | `listCartShippingMethods(cartId)`, `calculatePriceForShippingOption(...)` |
| `regions.ts` | `listRegions()`, `retrieveRegion(id)`, `getRegion(countryCode)` (in-memory cached) |
| `categories.ts` | `listCategories()`, `getCategoryByHandle(handle[])` (supports nested handles) |
| `collections.ts` | `retrieveCollection(id)`, `listCollections()`, `getCollectionByHandle(handle)` |
| `cookies.ts` | `getAuthHeaders()`, `getCacheTag()`, `getCacheOptions()`, `setAuthToken()`, `setCartId()` |

### 5.4 Modules / Components

#### Layout (`src/modules/layout/`)

| Component | Description |
|---|---|
| **Nav** | Sticky top navigation bar: hamburger/side menu, store name link, cart button with item count |
| **Footer** | Dark-themed footer (`bg-stone-900`) with copyright: "© 2026 10shirts. All rights reserved." |
| **CartDropdown** | Headless UI Popover; auto-opens for 5 seconds on cart modification; shows items, subtotal, checkout link |
| **CartButton** | Suspense-wrapped cart icon with live item count badge |
| **SideMenu** | Slide-out navigation with region/country selector |
| **CartMismatchBanner** | Warning banner when logged-in customer's cart doesn't match the active session cart |
| **FreeShippingPriceNudge** | Popup showing progress toward free shipping threshold |
| **CountrySelect** | Country/region switcher |
| **MedusaCTA** | "Powered by Medusa" badge (optional, removable) |

#### Checkout (`src/modules/checkout/`)

The checkout follows a **multi-step wizard** driven by the `?step=` query parameter:

```
Address → Delivery → Payment → Review → Order Placed
```

| Component | Description |
|---|---|
| **CheckoutForm** | Multi-step wizard container |
| **ShippingAddress** | Address form with auto-population for logged-in users |
| **Shipping** | Shipping method selection (radio group) |
| **Payment** | Payment method selection; initiates Stripe `PaymentSession` on selection |
| **PaymentWrapper** | Loads Stripe.js and wraps content in `<Elements>` provider with `clientSecret` |
| **PaymentButton** | Dispatches to `StripePaymentButton` or `ManualTestPaymentButton` |
| **StripeReturnHandler** | Handles 3D Secure return: retrieves PaymentIntent status → places order on success |
| **DiscountCode** | Promo code input field |
| **Review** | Final order review before placement |
| **CheckoutSummary** | Right column showing cart items and order totals |

**Stripe Payment Flow:**
1. Customer selects "Credit card" → `initiatePaymentSession()` creates payment session
2. Stripe `<PaymentElement>` iframe renders for card input
3. On submit: `elements.submit()` → `stripe.confirmPayment()` with `return_url`
4. For 3DS: redirects to bank → returns to `/checkout?payment_intent_client_secret=...`
5. `StripeReturnHandler` checks intent status → calls `placeOrder()` on success

#### Products (`src/modules/products/`)

| Component | Description |
|---|---|
| **ProductActions** | Add-to-cart form with variant selection, stock checking, quantity input |
| **MobileActions** | Sticky bottom bar on mobile (appears when main actions scroll out of view via `useIntersection`) |
| **OptionSelect** | Variant option selector (size, color) |
| **ProductPreview** | Product card for catalog listings |
| **ProductPrice** | Price display with original/sale/percentage-off |
| **ImageGallery** | Product image gallery |
| **ProductTabs** | Accordion with Description, Shipping & Returns tabs |
| **RelatedProducts** | "More products" section |
| **Thumbnail** | Responsive product thumbnail component |

**Product Detail Page Layout:**
```
┌──────────────┬──────────────┬──────────────┐
│ Product Info │ Image        │ Actions      │
│ + Tabs       │ Gallery      │ (Add to Cart)│
└──────────────┴──────────────┴──────────────┘
```

#### Cart (`src/modules/cart/`)

| Component | Description |
|---|---|
| **CartTemplate** | Full cart page with items list and summary |
| **CartItems** | Line item list |
| **CartPreview** | Compact cart preview (used in dropdown) |
| **CartSummary** | Order totals (subtotal, shipping, tax, discount, total) |
| **EmptyCartMessage** | Displayed when cart has no items |
| **SignInPrompt** | Encourages guest users to sign in |

#### Account (`src/modules/account/`)

| Component | Description |
|---|---|
| **LoginTemplate** | Login/register toggle forms |
| **AccountLayout** | Account page shell with sidebar navigation |
| **AccountOverview** | Dashboard with profile summary, recent orders |
| **OrderOverview** | Full order history list |
| **OrderCard** | Individual order card in list |
| **AddressBook** | Manage saved addresses |
| **ProfileName/Email/Phone/Password** | Editable profile fields |
| **ProfileBillingAddress** | Billing address editor |
| **TransferRequestForm** | Request order ownership transfer |

#### Order (`src/modules/order/`)

| Component | Description |
|---|---|
| **OrderCompletedTemplate** | Thank-you page after successful checkout |
| **OrderDetailsTemplate** | Full order details page |
| **OrderSummary** | Order summary section |
| **PaymentDetails** | Payment information display |
| **ShippingDetails** | Shipping info display |
| **Items** | Order items listing |

#### Home (`src/modules/home/`)

| Component | Description |
|---|---|
| **Hero** | Homepage hero banner |
| **FeaturedProducts** | Featured products grid |

#### Common UI (`src/modules/common/`)

| Component | Description |
|---|---|
| **Input** | Styled text input with floating label |
| **Modal** | Reusable modal dialog |
| **Radio** | Custom radio button |
| **Checkbox** | Custom checkbox |
| **NativeSelect** | Styled `<select>` dropdown |
| **LocalizedClientLink** | Client-side link that prepends `/{countryCode}/` |
| **InteractiveLink** | Animated link with hover underline |
| **CartTotals** | Cart totals breakdown (subtotal, shipping, tax, discount, total) |
| **LineItemPrice** | Individual line item price display |
| **LineItemUnitPrice** | Unit price with original/sale comparison |
| **LineItemOptions** | Variant options display (e.g., "Size: M") |
| **DeleteButton** | Delete action with confirmation |
| **Divider** | Horizontal divider |
| **FilterRadioGroup** | Radio group for filter selection |
| **Icons** | SVG icon components (Bancontact, iDeal, PayPal, Spinner, etc.) |

### 5.5 Hooks & Context

#### Hooks (`src/lib/hooks/`)

| Hook | Signature | Description |
|---|---|---|
| `useToggleState` | `(initial?) → { state, open, close, toggle }` | Boolean toggle with named controls |
| `useIntersection` | `(element, rootMargin) → { isVisible }` | IntersectionObserver wrapper for scroll-triggered visibility |

#### Context (`src/lib/context/`)

| Context | Description |
|---|---|
| `ModalProvider` / `useModal` | Provides `close()` function to modal children via React Context |

### 5.6 Utilities

| File | Export | Description |
|---|---|---|
| `money.ts` | `convertToLocale({ amount, currency_code })` | Formats currency using `Intl.NumberFormat` |
| `get-product-price.ts` | `getProductPrice(product)`, `getPricesForVariant(variant)` | Extracts calculated/original prices, percentage difference |
| `sort-products.ts` | `sortProducts(products, sortBy)` | Client-side sort: `price_asc`, `price_desc`, `created_at` |
| `compare-addresses.ts` | `compareAddresses(addr1, addr2)` | Deep address equality using lodash `pick` + `isEqual` |
| `medusa-error.ts` | `medusaError(error)` | Extracts and throws human-readable error from Axios errors |
| `env.ts` | `getBaseURL()` | Returns `NEXT_PUBLIC_BASE_URL` or `https://localhost:8000` |
| `isEmpty.ts` | `isEmpty(value)` | Null/undefined/empty check |
| `get-precentage-diff.ts` | `getPercentageDiff(original, calculated)` | Calculates price percentage difference |
| `repeat.ts` | `repeat(n)` | Creates array of `n` elements (for skeleton loops) |

### 5.7 Types

**`src/types/global.ts`:**
```typescript
type FeaturedProduct = {
  id: string
  title: string
  handle: string
  thumbnail?: string
}

type VariantPrice = {
  calculated_price_number: number
  calculated_price: string
  original_price_number: number
  original_price: string
  currency_code: string
  price_type: string
  percentage_diff: string
}

type StoreFreeShippingPrice = StorePrice & {
  target_reached: boolean
  target_remaining: number
  remaining_percentage: number
}
```

**`src/types/icon.ts`:**
```typescript
type IconProps = {
  color?: string
  size?: string | number
} & React.SVGAttributes<SVGElement>
```

### 5.8 Styling

#### Tailwind Configuration

- **Preset:** Extends `@medusajs/ui-preset`
- **Dark Mode:** `class`-based
- **Font Family:** Inter (system font fallback stack)
- **Custom Breakpoints:**

| Name | Width |
|---|---|
| `2xsmall` | 320px |
| `xsmall` | 512px |
| `small` | 1024px |
| `medium` | 1280px |
| `large` | 1440px |
| `xlarge` | 1680px |

- **Custom Colors:** Grey scale (`grey-0` through `grey-90`)
- **Border Radii:** `soft: 2px`, `base: 4px`, `rounded: 8px`, `circle: 9999px`
- **Animations:** `ring`, `fade-in-right`, `fade-in-top`, `fade-out-top`

#### Global CSS (`src/styles/globals.css`)

Custom utility classes:
- `.content-container` — `max-width: 1440px`, centered with auto margins
- `.contrast-btn` — Pill-shaped button style
- `.no-scrollbar` — Cross-browser scrollbar hiding
- Floating label input animation (translate on focus/filled state)
- Typography scale: `.text-xsmall-regular`, `.text-small-regular`, `.text-small-semi`, `.text-base-regular`, `.text-base-semi`

#### Path Aliases (`tsconfig.json`)

| Alias | Maps To |
|---|---|
| `@lib/*` | `src/lib/*` |
| `@modules/*` | `src/modules/*` |
| `@pages/*` | `src/pages/*` |

### 5.9 Cookie Consent

**File:** `src/cookieConsent.tsx`

Uses `vanilla-cookieconsent` v3 for GDPR-compliant cookie management.

**Categories:**
| Category | Type | Description |
|---|---|---|
| `necessary` | Required (read-only) | Essential site cookies |
| `analytics` | Optional | Analytics tracking |
| `marketing` | Optional | Marketing/advertising |

Stores consent in `cookie_consent` cookie (365 days, `SameSite=Lax`). Includes a React fallback modal if the library fails to initialize.

---

## 6. Backend (Medusa v2)

### 6.1 Configuration

**File:** `medusa-backend/my-medusa-store/medusa-config.ts`

```typescript
defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: "http://localhost:8000,https://localhost:8000",
      adminCors: "http://localhost:7001,https://localhost:7001",
      authCors: "http://localhost:7001,https://localhost:7001",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [{
    key: "payment",
    options: {
      providers: [{
        resolve: "@medusajs/payment-stripe",
        id: "stripe",
        options: { apiKey: process.env.STRIPE_API_KEY }
      }]
    }
  }]
})
```

**Key points:**
- Only custom module: Stripe payment provider attached to the built-in payment module
- CORS configured for local development (storefront on `:8000`, admin on `:7001`)
- Database and Redis URLs from environment variables
- No custom modules, workflows, jobs, or links are implemented

### 6.2 API Routes

```
src/api/
├── store/custom/route.ts     → GET /store/custom (placeholder, returns 200)
├── admin/custom/route.ts     → GET /admin/custom (placeholder, returns 200)
└── stripe/
    ├── utils.ts              → Webhook utilities & idempotency tracker
    └── webhook/
        └── route.ts          → POST /stripe/webhook (main webhook handler)
```

### 6.3 Stripe Webhook Handler

**Endpoint:** `POST /stripe/webhook`

This is the primary integration point for Stripe event processing.

#### Supported Webhook Events

| Event | Action |
|---|---|
| `payment_intent.succeeded` | Logs success (capture is handled by the `auto-capture-payment` subscriber) |
| `payment_intent.payment_failed` | Updates payment metadata with error/decline codes; marks order `payment_status: "failed"` |
| `payment_intent.requires_action` | Logs for monitoring (3DS authentication required) |
| `payment_intent.canceled` | Logs cancellation |
| `charge.succeeded` | Retrieves parent PaymentIntent and processes success |
| `charge.refunded` | Updates metadata; marks order `payment_status: "refunded"` |
| `charge.dispute.created` | Handles payment disputes |
| `checkout.session.completed` | Logs for Stripe payment link flows |

#### Security & Idempotency

- **Production:** Verifies webhook signature via `stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)` — returns 400 on failure
- **Development:** Signature verification is skipped (with a warning log)
- **Idempotency:** Uses `WebhookEventTracker` class with Redis-backed deduplication (24h TTL) and in-memory `Set` fallback

#### Webhook Utilities (`src/api/stripe/utils.ts`)

| Utility | Description |
|---|---|
| `WebhookEventTracker` | Redis-backed idempotency tracker with 24h TTL + in-memory Set fallback |
| `findPaymentCollectionByStripeId` | Finds Medusa payment collection matching a Stripe PaymentIntent ID |
| `findOrderByPaymentCollectionId` | Finds the order linked to a payment collection |
| `capturePaymentInMedusa` | Triggers Medusa payment capture |
| `updateOrderPaymentStatus` | Updates order's payment status metadata |
| `convertStripeCentsToAmount` | Converts Stripe amounts (cents) to standard amounts |
| `logPaymentEvent` | Structured logging for payment events |
| `extractStripeErrorDetails` | Extracts human-readable error from Stripe response |

### 6.4 Subscribers

**File:** `src/subscribers/auto-capture-payment.ts`

**Event:** `order.placed`
**Subscriber ID:** `auto-capture-payment-handler`

Automatically captures Stripe payments after an order is placed:

1. Lists all payments in the system
2. Filters to Stripe payments (`provider_id === 'pp_stripe_stripe'`) created within the last 60 seconds that are not yet captured
3. Calls `paymentModule.capturePayment({ payment_id })` for each matching payment

> **Note:** This subscriber uses a broad time-window filter rather than being scoped to the specific order's payments. This is a design choice that works well for low-traffic stores but could have edge cases in high-concurrency scenarios.

### 6.5 Seed Script

**File:** `src/scripts/seed.ts`
**Command:** `npm run seed` (= `medusa exec ./src/scripts/seed.ts`)

Creates initial store data:

| Entity | Details |
|---|---|
| **Region** | "Europe" with EUR (default) and USD |
| **Countries** | GB, DE, DK, SE, FR, ES, IT |
| **Tax Regions** | One per country (`tp_system` provider) |
| **Stock Location** | "European Warehouse" (Copenhagen, DK) |
| **Fulfillment** | "European Warehouse delivery" with service zones for all 7 countries |
| **Shipping Options** | "Standard Shipping" ($10, 2-3 days) + "Express Shipping" ($10, 24h) — both manual provider |
| **Publishable API Key** | "Webshop" — linked to Default Sales Channel |
| **Product Categories** | Shirts, Sweatshirts, Pants, Merch |
| **Products** | "Medusa T-Shirt" with S/M/L/XL × Black/White variants, €10/€15 pricing |

---

## 7. Payment Integration (Stripe)

### Overview

The platform implements a full Stripe payment integration with support for:
- Credit/debit cards via Stripe PaymentElement
- 3D Secure (SCA) authentication flow
- iDeal, Bancontact (configured but provider-dependent)
- Manual/test payments (development mode)
- Automatic payment capture on order placement
- Webhook-driven status updates (refunds, disputes, failures)

### Payment Flow (End-to-End)

```
Customer selects "Credit Card"
        │
        ▼
initiatePaymentSession() ──────── Creates Stripe PaymentIntent
        │                          via Medusa Payment Module
        ▼
Stripe <PaymentElement> renders ── Secure iframe for card input
        │
        ▼
Customer clicks "Pay"
        │
        ▼
stripe.confirmPayment() ────────── Sends card data directly to Stripe
        │
        ├── No 3DS Required ──────► placeOrder() → cart.complete()
        │                                     │
        │                                     ▼
        │                           order.placed event fires
        │                                     │
        │                                     ▼
        │                           auto-capture-payment subscriber
        │                           captures the PaymentIntent
        │
        └── 3DS Required ─────────► Redirect to bank authentication
                                           │
                                           ▼
                                    Return to /checkout?payment_intent_client_secret=...
                                           │
                                           ▼
                                    StripeReturnHandler checks intent status
                                           │
                                           ▼
                                    placeOrder() on success
```

### Content Security Policy (CSP)

The `next.config.js` builds a CSP header that allows Stripe's required domains:

| Directive | Allowed Sources |
|---|---|
| `script-src` | `js.stripe.com`, `m.stripe.network` |
| `frame-src` | `js.stripe.com`, `hooks.stripe.com`, `m.stripe.network`, `m.stripe.com` |
| `connect-src` | `api.stripe.com`, `errors.stripe.com`, `m.stripe.network`, Medusa backend URL |
| `img-src` | `*.stripe.com` |

### Payment Provider Constants

Defined in `src/lib/constants.tsx`:

| Provider ID | Display Name | Icon |
|---|---|---|
| `pp_stripe_stripe` | Credit card | Credit card icon |
| `pp_stripe-ideal_stripe` | iDeal | iDeal icon |
| `pp_stripe-bancontact_stripe` | Bancontact | Bancontact icon |
| `pp_paypal_paypal` | PayPal | PayPal icon |
| `pp_system_default` | Manual Payment | Bank note icon |

### Zero-Decimal Currencies

The following currencies do not require division by 100 when displaying amounts:
`KRW`, `JPY`, `VND`, `CLP`, `PYG`, `XAF`, `XOF`, `BIF`, `DJF`, `GNF`, `KMF`, `MGA`, `RWF`, `XPF`, `HUF`, `TWD`

---

## 8. Infrastructure & DevOps

### 8.1 Docker (Local Development)

**File:** `medusa-backend/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15
    restart: always
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: medusa
      POSTGRES_PASSWORD: medusa
      POSTGRES_DB: medusa
    volumes:
      - ./postgres-data:/var/lib/postgresql/data

  redis:
    image: redis
    restart: always
    ports: ["6379:6379"]
```

**Local setup:**
```bash
cd medusa-backend
docker-compose up -d          # Start PostgreSQL + Redis
cd my-medusa-store
npm run seed                  # Seed initial data
npm run dev                   # Start Medusa backend (port 9000)
```

### 8.2 Railway (Production Deployment)

**File:** `medusa-backend/my-medusa-store/railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[env]
NODE_ENV = "production"
```

The backend is configured for deployment on **Railway** with:
- Nixpacks-based builds
- Health check on `/health` endpoint
- Auto-restart on failure (max 3 retries)

### Sitemap Configuration

**File:** `next-sitemap.js`

- Generates `sitemap.xml` and `robots.txt`
- **Excludes:** `/checkout`, `/account/*` (private pages)

---

## 9. Environment Variables

### Frontend (Next.js)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | **Yes** | Medusa publishable API key (validated at build time) |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | No | Medusa backend URL (default: `http://localhost:9000`) |
| `NEXT_PUBLIC_BASE_URL` | No | Public storefront URL (default: `https://localhost:8000`) |
| `NEXT_PUBLIC_DEFAULT_REGION` | No | Default region/country code (default: `us`) |
| `NEXT_PUBLIC_STRIPE_KEY` | No | Stripe publishable key (for PaymentElement) |
| `MEDUSA_BACKEND_URL` | No | Server-side Medusa backend URL |
| `REVALIDATE_WINDOW` | No | Next.js revalidation window in seconds |

### Backend (Medusa)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string |
| `JWT_SECRET` | **Yes** (production) | JWT signing secret |
| `COOKIE_SECRET` | **Yes** (production) | Cookie signing secret |
| `STRIPE_API_KEY` | **Yes** | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | **Yes** (production) | Stripe webhook signing secret |
| `STORE_CORS` | No | Allowed storefront origins |
| `ADMIN_CORS` | No | Allowed admin panel origins |
| `AUTH_CORS` | No | Allowed auth origins |
| `NODE_ENV` | No | Environment (`development` / `production`) |

---

## 10. Development Guide

### Prerequisites

- **Node.js** ≥ 20
- **Docker** (for PostgreSQL + Redis)
- **Stripe account** with API keys

### Quick Start

```bash
# 1. Start infrastructure
cd medusa-backend
docker-compose up -d

# 2. Setup backend
cd my-medusa-store
cp .env.template .env         # Configure environment variables
npm install
npm run seed                  # Seed database with initial data
npm run dev                   # Starts on http://localhost:9000

# 3. Setup frontend (new terminal)
cd nextjs-starter-medusa
cp .env.template .env.local   # Configure environment variables
yarn install
yarn dev                      # Starts on http://localhost:8000
```

### Key URLs

| Service | URL |
|---|---|
| Storefront | http://localhost:8000 |
| Medusa Backend | http://localhost:9000 |
| Medusa Admin | http://localhost:7001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Project Scripts

#### Frontend (`package.json`)

| Command | Description |
|---|---|
| `yarn dev` | Start dev server with Turbopack on port 8000 |
| `yarn build` | Production build |
| `yarn start` | Start production server on port 8000 |
| `yarn lint` | Run ESLint |

#### Backend (`medusa-backend/my-medusa-store/package.json`)

| Command | Description |
|---|---|
| `npm run dev` | Start Medusa in development mode |
| `npm run build` | Build Medusa project |
| `npm run start` | Start Medusa in production mode |
| `npm run seed` | Run seed script to populate initial data |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration:http` | Run HTTP integration tests |
| `npm run test:integration:modules` | Run module integration tests |

---

## 11. Testing

### Backend Tests

The backend supports three levels of testing via Jest:

| Type | Command | Description |
|---|---|---|
| Unit | `npm run test:unit` | Unit tests (isolated, fast) |
| HTTP Integration | `npm run test:integration:http` | End-to-end HTTP API tests |
| Module Integration | `npm run test:integration:modules` | Module-level integration tests |

All test commands use `--experimental-vm-modules` for ESM support and `--runInBand --forceExit` for sequential execution.

### Stripe Testing

The project includes comprehensive Stripe testing documentation:
- `medusa-backend/my-medusa-store/docs/STRIPE_TESTING.md` — Test scenarios and card numbers
- `medusa-backend/my-medusa-store/docs/STRIPE_WEBHOOKS.md` — Webhook testing guide
- `medusa-backend/my-medusa-store/docs/STRIPE_QUICK_REFERENCE.md` — Quick reference
- `medusa-backend/my-medusa-store/STRIPE_CLI_INSTALL.md` — CLI installation guide
- `medusa-backend/my-medusa-store/stripe-test.ps1` — PowerShell test script

---

## 12. Security Considerations

### Authentication
- JWT-based authentication with `_medusa_jwt` cookie (HttpOnly, Secure in production)
- Cart ID stored in HttpOnly cookie to prevent client-side manipulation
- Auth tokens expire after 7 days

### Payment Security
- **PCI Compliance:** Card data never touches the application server — Stripe Elements handles card input in a secure iframe
- **CSP Headers:** Content Security Policy restricts script/frame/connect sources to Stripe's domains
- **Webhook Verification:** Production webhook handler verifies Stripe signatures; development mode skips verification with warnings
- **Idempotency:** Webhook events are deduplicated via Redis-backed tracker (24h TTL) preventing duplicate processing

### CORS
- Store CORS: `http://localhost:8000` (configurable via `STORE_CORS`)
- Admin CORS: `http://localhost:7001`
- Auth CORS: `http://localhost:7001`

### Cookie Security
- Authentication cookies use `HttpOnly` + `Secure` (in production) + `SameSite=Strict`
- Cookie consent compliant with GDPR (necessary / analytics / marketing categories)

### Build-Time Validation
- `check-env-variables.js` ensures required environment variables (`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`) are present before build

### Known Considerations
- `JWT_SECRET` and `COOKIE_SECRET` default to `"supersecret"` in development — must be overridden in production
- TypeScript and ESLint build errors are ignored (`ignoreBuildErrors: true`) in `next.config.js`
- The `auto-capture-payment` subscriber uses a broad time-window filter (60 seconds) rather than targeting the specific order's payments

---

*Generated from repository analysis — nextjs-starter-medusa (10shirts)*
