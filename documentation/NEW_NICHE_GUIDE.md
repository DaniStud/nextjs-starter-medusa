# Adding a New Niche to the Programmatic POD Pipeline

This guide walks you through creating products for a new niche using the existing pipeline.

## Overview

The pipeline works in 4 steps:

```
base-matrix.json → generate-content.mjs → generated-matrix.json → /mvp-test page
```

You define **roles** (identities) and **passions** (interests). The script cross-multiplies every role × passion pair into a product combo and generates an AI description for each.

**Example:** 3 roles × 4 passions = 12 product combos, each with a unique description and URL slug.

---

## Step 1: Define Your Niche in `src/data/base-matrix.json`

Replace or extend the `roles` and `passions` arrays. Each entry needs a unique `id` and a `name`.

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

## Step 3: Generate AI Descriptions

### Prerequisites

- `GEMINI_API_KEY` set in `.env.local` (get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- Active Gemini quota (free tier allows ~15 RPM)

### Run the script

```bash
npm run generate:matrix
```

This reads `base-matrix.json`, calls Gemini for each combo, and writes the output to `src/data/generated-matrix.json`.

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
  "description": "AI-generated ~150 char description..."
}
```

The `comboId` is an auto-generated URL-friendly slug designed to become a Medusa product `handle`.

### If Gemini quota is exhausted

You can write descriptions manually in `src/data/generated-matrix.json`. Follow the same shape above. The page reads this file directly.

---

## Step 4: Verify

Start the dev server and visit the page:

```bash
npm run dev
# → http://localhost:8000/mvp-test
```

You should see a card grid with your new role × passion combos, each displaying the icon, title, proof-of-concept string, AI description, and URL slug.

---

## Quick Reference

| What | Where |
|---|---|
| Input matrix (roles + passions) | `src/data/base-matrix.json` |
| Generated output | `src/data/generated-matrix.json` |
| Generation script | `scripts/generate-content.mjs` |
| Raw SVG source files | `assets/raw-svgs/` |
| SVGR-generated React components | `src/components/icons/` |
| Icon string → component mapping | `src/utils/iconMap.ts` |
| MVP display page | `src/app/mvp-test/page.tsx` |
| Gemini API key | `.env.local` → `GEMINI_API_KEY` |
| NPM shortcut | `npm run generate:matrix` |

---

## Tips

- **Scaling up:** Adding a 4th role to a 5-passion matrix goes from 15 → 20 combos. The script handles any size automatically.
- **Customizing the AI prompt:** Edit the `prompt` string in `scripts/generate-content.mjs` (line ~72). You can change tone, length, or style.
- **Rate limits:** The script waits 1 second between API calls (`DELAY_MS` in the script). Increase this if you hit 429 errors.
- **Re-running:** `npm run generate:matrix` overwrites `generated-matrix.json` entirely. Back it up first if you've manually edited descriptions.
