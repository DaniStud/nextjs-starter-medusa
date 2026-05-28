# Adding a New Niche to the Programmatic POD Pipeline

This guide walks you through creating products for a new niche using the existing pipeline.

## Overview

The full pipeline works in 5 steps:

```
niche-matrix.json → discover-keywords.mjs → validate-volume.mjs → generate-content.mjs → /mvp-test page
```

1. **Define** roles × passions in a matrix JSON file
2. **Discover** real search queries via Google Autocomplete (free)
3. **Validate** search volume via DataForSEO API (~$0.075 per batch)
4. **Generate** SEO-optimized product descriptions via Gemini
5. **Display** on the MVP test page

**Example:** 5 roles × 10 passions = 50 products, each with an SEO keyword and AI description.

---

## Step 1: Define Your Niche Matrix

Create a new file in `src/data/` (e.g., `src/data/my-niche-matrix.json`). Each entry needs a unique `id` and a `name`.

```json
{
  "roles": [
    { "id": "r1", "name": "Dog Dad" },
    { "id": "r2", "name": "Gym Bro" },
    { "id": "r3", "name": "Night Owl" }
  ],
  "passions": [
    { "id": "p1", "name": "Craft Beer", "iconMapKey": null },
    { "id": "p2", "name": "Fantasy Football", "iconMapKey": null },
    { "id": "p3", "name": "Vinyl Records", "iconMapKey": null }
  ]
}
```

**Rules:**
- `id` must be unique within its array (used internally, not shown to users)
- `name` is the human-readable label shown on the page and sent to the AI prompt
- `iconMapKey` maps to an SVG React component — set to `null` if you don't have one yet (a `[Icon Missing]` fallback renders instead)

---

## Step 2 (Optional): Add SVG Icons

### 2a. Drop raw SVGs into the assets folder

```
assets/raw-svgs/
  BeerMug.svg
  Football.svg
  VinylDisc.svg
```

File names become component names — use PascalCase, no spaces.

### 2b. Convert SVGs to React components

```bash
npx @svgr/cli --out-dir src/components/icons --typescript -- assets/raw-svgs
```

This generates files like `src/components/icons/BeerMug.tsx`.

### 2c. Register new icons in `src/utils/iconMap.ts`

```ts
import SvgBeerMug from "../components/icons/BeerMug"
import SvgFootball from "../components/icons/Football"
import SvgVinylDisc from "../components/icons/VinylDisc"
// ... keep existing imports

export const IconDictionary: Record<string, IconComponent> = {
  // ... keep existing entries
  BeerMug: SvgBeerMug,
  Football: SvgFootball,
  VinylDisc: SvgVinylDisc,
}
```

### 2d. Set `iconMapKey` in `base-matrix.json`

```json
{ "id": "p1", "name": "Craft Beer", "iconMapKey": "BeerMug" }
```

The `iconMapKey` string must exactly match the key in `IconDictionary`.

---

## Step 3: Discover Keywords (Google Autocomplete)

Before generating descriptions, discover what people actually search for. This step is free — no API key needed.

### 3a. Point the discovery script at your matrix

Open `scripts/discover-keywords.mjs` and update the matrix path at the top of `main()`:

```js
const matrixPath = resolve(ROOT, "src/data/my-niche-matrix.json")
```

### 3b. Run discovery

```bash
npm run discover:keywords
```

This queries Google Autocomplete with multiple seed phrases per combo (e.g., `"Dog Dad Craft Beer gift"`, `"funny Dog Dad Craft Beer"`) and writes all suggestions to `src/data/keyword-discovery.json`.

**Output per combo:**
```json
{
  "comboId": "dog-dad-craft-beer",
  "role": "Dog Dad",
  "passion": "Craft Beer",
  "seeds": ["dog dad craft beer gift", "dog dad craft beer shirt", ...],
  "suggestions": ["dog dad beer gift set", "funny dog dad shirt", ...],
  "topKeyword": "dog dad beer gift set"
}
```

**Tips:**
- The script uses 10 seed phrases per combo for broad coverage
- It pauses 300ms between Google requests + 500ms between combos to avoid throttling
- If you get 0 suggestions, your seed phrases may be too specific — edit the `seeds` array in the script

---

## Step 4: Validate Search Volume (DataForSEO)

### Prerequisites

- `DATAFORSEO_AUTH` set in `.env.local` — Base64 of `email:password`
- DataForSEO account with credits ([dataforseo.com](https://dataforseo.com))

### Run validation

```bash
npm run validate:keywords
```

This sends all unique suggestions to DataForSEO's Google Ads Search Volume API and writes ranked results to `src/data/keyword-matrix.json`.

**Cost:** ~$0.075 per batch of up to 1000 keywords. A 50-combo niche with ~400 unique suggestions costs about $0.075 total.

**Output per combo:**
```json
{
  "comboId": "dog-dad-craft-beer",
  "role": "Dog Dad",
  "passion": "Craft Beer",
  "bestKeyword": "dog dad beer lover gift",
  "bestVolume": 1300,
  "bestCompetition": "HIGH",
  "bestCpc": 0.93,
  "allKeywords": [
    { "keyword": "dog dad beer lover gift", "volume": 1300, "competition": "HIGH", "cpc": 0.93 },
    { "keyword": "funny dog dad shirt", "volume": 590, "competition": "MEDIUM", "cpc": 0.45 }
  ]
}
```

**Notes:**
- Keywords with non-ASCII characters are automatically filtered out (DataForSEO rejects them)
- Results are sorted by volume — `bestKeyword` is the highest-volume suggestion
- The script handles batching (1000 keywords per request) and rate limiting automatically

---

## Step 5: Generate AI Descriptions

### Prerequisites

- `GEMINI_API_KEY` set in `.env.local` (get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- Active Gemini billing (free tier has very limited quota)

### Run the script

```bash
npm run generate:matrix
```

This reads `keyword-matrix.json` (or falls back to `base-matrix.json` if no keyword data exists), calls Gemini 2.5 Flash for each combo, and writes the output to `src/data/generated-matrix.json`.

When keyword data is available, the SEO keyword is included in the prompt so descriptions incorporate it naturally.

**What it produces** (one entry per combo):
```json
{
  "comboId": "dog-dad-craft-beer",
  "role": "Dog Dad",
  "roleId": "r1",
  "passion": "Craft Beer",
  "passionId": "p1",
  "iconMapKey": "BeerMug",
  "title": "Dog Dad × Craft Beer",
  "bestKeyword": "dog dad beer lover gift",
  "bestVolume": 1300,
  "description": "AI-generated ~150 char SEO-optimized description...",
  "shirtText": "Beer. Dogs. Repeat."
}
```

- `description` is the SEO-optimized product page copy (~150 chars)
- `shirtText` is the short punchy slogan to print on the shirt (max ~6 words)
```

The `comboId` is an auto-generated URL-friendly slug designed to become a Medusa product `handle`.

### If Gemini quota is exhausted

You can write descriptions manually in `src/data/generated-matrix.json`. Follow the same shape above. The page reads this file directly.

---

## Step 6: Verify

Start the dev server and visit the page:

```bash
npm run dev
# → http://localhost:8000/mvp-test
```

You should see a card grid with your new role × passion combos, each displaying an emoji icon, title, SEO keyword badge with search volume, AI description, and URL slug.

---

## Quick Reference

| What | Where |
|---|---|
| Input matrix (roles + passions) | `src/data/your-niche-matrix.json` |
| Keyword discovery output | `src/data/keyword-discovery.json` |
| Keyword volume output | `src/data/keyword-matrix.json` |
| Generated output (final) | `src/data/generated-matrix.json` |
| SP product discovery cache | `src/data/sp-product-discovery.json` |
| Keyword discovery script | `scripts/discover-keywords.mjs` |
| Volume validation script | `scripts/validate-volume.mjs` |
| Content generation script | `scripts/generate-content.mjs` |
| Design rendering script | `scripts/render-text-designs.mjs` |
| Product creation script | `scripts/create-niche-products.mjs` |
| Rendered text designs | `assets/text-designs/` |
| SP preview mockups | `assets/product-previews/` |
| Raw SVG source files | `assets/raw-svgs/` |
| SVGR-generated React components | `src/components/icons/` |
| Icon string → component mapping | `src/utils/iconMap.ts` |
| MVP display page | `src/app/mvp-test/page.tsx` |
| Gemini API key | `.env.local` → `GEMINI_API_KEY` |
| DataForSEO auth | `.env.local` → `DATAFORSEO_AUTH` |
| Shirtplatform credentials | `.env.local` → `SHIRTPLATFORM_*` |
| Medusa admin credentials | `.env.local` → `MEDUSA_ADMIN_*` |
| NPM shortcuts | `npm run discover:keywords`, `npm run validate:keywords`, `npm run generate:matrix`, `npm run render:designs`, `npm run create:products` |

---

## Tips

- **Scaling up:** Adding a 4th role to a 5-passion matrix goes from 15 → 20 combos. The script handles any size automatically.
- **Customizing the AI prompt:** Edit the `prompt` string in `scripts/generate-content.mjs`. You can change tone, length, or style.
- **Rate limits:** The generation script waits 1.5 seconds between Gemini calls (`DELAY_MS`). Increase this if you hit 429 errors.
- **Re-running:** Each script overwrites its output file entirely. Back up files first if you've manually edited them.
- **Skipping keyword steps:** If you don't need SEO data, you can skip Steps 3-4 and go straight to `npm run generate:matrix`. It falls back to `base-matrix.json` and generates descriptions without keyword data.
- **Existing matrices:** `src/data/base-matrix.json` (3×3 original) and `src/data/pet-niche-matrix.json` (5×10 pet-lover niche) are available as references.
- **Model:** Currently uses Gemini 2.5 Flash (`gemini-2.5-flash`). Change the model name in `scripts/generate-content.mjs` if needed.

---

## Design Pipeline

The pipeline supports multiple design strategies. Each combo's `shirtText` field is the source for all design approaches.

### Current: Text-Only Designs

Render the `shirtText` slogan as a high-res PNG using `node-canvas`.

```bash
npm run render:designs
```

This reads `generated-matrix.json` and produces two PNGs per combo:
- `{comboId}-on-white.png` — dark text (for printing on white shirts)
- `{comboId}-on-black.png` — light text (for printing on black shirts)

Output: `assets/text-designs/` (e.g., 50 combos → 100 PNGs)

### Future: AI-Generated SVG Designs

A planned upgrade to generate unique vector artwork per combo using AI image generation, then convert to SVG for scalable print-ready output.

---

## Creating Products (Automated)

Once you have `generated-matrix.json` with `shirtText` and rendered design PNGs:

```bash
npm run create:products
```

This script:
1. Reads `generated-matrix.json` + design PNGs from `assets/text-designs/`
2. Gets preview mockup images from Shirtplatform (design rendered on shirt)
3. Creates products in Medusa with SP metadata on each variant (DRAFT status)
4. Skips combos where the product handle already exists (safe to re-run)

See [createProducts.md](createProducts.md) for details on how the Shirtplatform integration and variant metadata work.
