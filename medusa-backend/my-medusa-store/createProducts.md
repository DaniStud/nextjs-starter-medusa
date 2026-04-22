# Creating Dropship Products (Shirtplatform + Medusa)

End-to-end guide for adding a new print-on-demand product.
Every order placed in Medusa is auto-forwarded to Shirtplatform for production via the `order-placed-shirtplatform` subscriber.

---

## Overview

```
1. Find the blank product IDs on Shirtplatform (product, colors, sizes)
2. Prepare your design image (PNG, high-res)
3. Convert the design to base64
4. Create the product in Medusa Admin with Shirtplatform metadata on each variant
5. Test by placing an order
```

---

## Step 1 — Find Shirtplatform Product IDs

Use the discovery route to list available products and their IDs:

```
GET http://localhost:9000/admin/sp-test
```

This returns all products with their expanded details: assigned colors, sizes, views, and print technologies.

### Key IDs you need per product

| Field | Description | Example |
|---|---|---|
| `productId` | Shirtplatform base product | `46881` (Crafter T unisex Men) |
| `assignedColorId` | Color variant | `302483` (White) |
| `assignedSizeId` | Size variant | `171089` (M) |
| `viewPosition` | Print area | `FRONT` or `BACK` |

### Example: StanleyStella Crafter T unisex

| Size | assignedSizeId |
|------|---------------|
| S | 171088 |
| M | 171089 |
| L | 171090 |
| XL | 171091 |
| XXL | 171092 |
| 3XL | 171093 |

- **Men** productId: `46881`
- **Women** productId: `46884`
- **White** assignedColorId: `302483`
- **FRONT** view: `128258`
- **BACK** view: `128259`

---

## Step 2 — Prepare Your Design

- Format: **PNG** (JPEG also supported)
- Resolution: **300 DPI** recommended
- Dimensions: The design will be centered on the print area by default
- File size: No strict limit, but keep it reasonable (< 5 MB)

The design file lives in your project, e.g. `public/images/my-design.png`.

---

## Step 3 — Convert Design to Base64

The design is sent **inline** with each order as a base64 string. Convert it once and store the string in the variant metadata.

### PowerShell

```powershell
$bytes = [System.IO.File]::ReadAllBytes("public/images/my-design.png")
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
# Paste into Medusa Admin variant metadata
```

### Node.js

```js
const fs = require('fs');
const base64 = fs.readFileSync('public/images/my-design.png').toString('base64');
console.log(base64);
```

### Bash

```bash
base64 -w 0 public/images/my-design.png | pbcopy
```

---

## Step 4 — Create Product in Medusa Admin

1. Go to **Medusa Admin → Products → Create**
2. Fill in the product details (name, description, images, price, etc.)
3. Create **one variant per size** (e.g. S, M, L, XL, XXL, 3XL)
4. On **each variant**, add the following metadata keys:

### Required Variant Metadata

| Key | Type | Description | Example |
|-----|------|-------------|---------|
| `shirtplatform_product_id` | number | SP base product ID | `46881` |
| `shirtplatform_assigned_color_id` | number | SP color ID | `302483` |
| `shirtplatform_assigned_size_id` | number | SP size ID (varies per variant!) | `171089` |
| `shirtplatform_motive_attachment` | string | Base64 of design PNG | `iVBORw0KGgo...` |
| `shirtplatform_motive_filename` | string | Original filename | `10shirt-logo.png` |
| `shirtplatform_view_position` | string | Print side (default: FRONT) | `FRONT` |

> **Important**: `shirtplatform_assigned_size_id` is the **only field that changes** between variants of the same color. All other metadata fields are identical.

### Example: "The 10 T-Shirt" — Size M variant metadata

```json
{
  "shirtplatform_product_id": 46881,
  "shirtplatform_assigned_color_id": 302483,
  "shirtplatform_assigned_size_id": 171089,
  "shirtplatform_motive_attachment": "iVBORw0KGgoAAAANSUhEUg...",
  "shirtplatform_motive_filename": "10shirt-logo.png",
  "shirtplatform_view_position": "FRONT"
}
```

For Size L, only `shirtplatform_assigned_size_id` changes to `171090`.

---

## Step 5 — What Happens When an Order Is Placed

The `order-placed-shirtplatform` subscriber handles everything automatically:

```
Customer places order
  → order.placed event fires
  → Subscriber reads order items + variant metadata
  → Creates Shirtplatform order (with shipping address, country)
  → For each item with SP metadata:
      → Sends CreatorSE request with inline base64 motive
      → Design is rendered on the product at the specified view position
  → Commits the order to production
  → Stores shirtplatform_order_id in Medusa order metadata
```

Items **without** Shirtplatform metadata are skipped (non-dropship products).

---

## Step 6 — Verify

1. Place a test order through the storefront
2. Check the Medusa order metadata for `shirtplatform_order_id`
3. Log in to [Shirtplatform Dashboard](https://api.shirtplatform.com) and verify:
   - Order exists with correct items
   - Preview shows the design on the product
   - Shipping address is correct

---

## Technical Details

### CreatorSE JSON Structure (Critical)

The JSON format differs from the XML format in the API docs. When sending JSON:

```json
{
  "creatorse_design": {
    "productId": 46881,
    "amount": 1,
    "assignedColor": { "id": 302483 },
    "assignedSize": { "id": 171089 },
    "compositions": {
      "creatorse_composition": [{
        "productArea": {
          "assignedView": {
            "view": { "position": "FRONT" }
          }
        },
        "elements": [{
          "creatorse_designElementMotive": {
            "motive": {
              "attachment": "<base64-string>",
              "filename": "design.png"
            },
            "position": {
              "horizontalCenter": "0",
              "verticalCenter": "0"
            }
          }
        }]
      }]
    }
  }
}
```

> **WARNING**: XML docs show `<creatorse_element>` but JSON **must** use `creatorse_designElementMotive`. Using `creatorse_element` in JSON silently fails — the order is created but the design is blank.

### Motive Delivery Methods

| Method | Status | Notes |
|--------|--------|-------|
| Inline base64 (`motive.attachment`) | **Working** | Used in production. Design sent with each order. |
| Motive ID reference (`motive.id`) | Partial | Shop motives: bitmap upload endpoint broken (500). User motives: don't render. |
| URL reference (`motive.url`) | Untested | Requires publicly accessible URL. |

### Position Options

```json
// Center on print area (default)
{ "horizontalCenter": "0", "verticalCenter": "0" }

// Fixed margins (mm)
{ "left": "10", "right": "10", "top": "10", "bottom": "10" }

// Percentage margins
{ "left": "10%", "right": "10%", "top": "10%", "bottom": "10%" }
```

### Shirtplatform Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Account ID | 387 | Our Shirtplatform account |
| Shop ID | 1597 | Our shop |
| Carrier ID | 872 | Generic Standard shipping |
| Denmark Country ID | 4742 | DK |
| Digital Print Tech | 1984 | Default print technology |
| Digital DTF Tech | 1982 | Alternative print technology |

---

## Relevant Code Files

| File | Purpose |
|------|---------|
| `src/modules/shirtplatform/service.ts` | API client with `addOrderedProductUsingCreatorSE()` |
| `src/subscribers/order-placed-shirtplatform.ts` | Auto-forwards orders to Shirtplatform |
| `src/api/admin/sp-test/route.ts` | Discovery route (temporary, for finding product IDs) |
| `src/modules/shirtplatform/index.ts` | Module registration |

---

## Adding a New Product — Checklist

- [ ] Find the product on Shirtplatform (use `/admin/sp-test`)
- [ ] Note down: `productId`, `assignedColorId`, `assignedSizeId` per size
- [ ] Prepare design PNG (300 DPI, transparent background if needed)
- [ ] Convert to base64
- [ ] Create product in Medusa Admin
- [ ] Create one variant per size with all metadata fields
- [ ] Place a test order and verify on Shirtplatform dashboard
- [ ] Check preview image shows design correctly
