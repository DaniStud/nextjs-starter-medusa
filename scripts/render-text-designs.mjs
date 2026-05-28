/**
 * render-text-designs.mjs
 *
 * Renders each combo's `shirtText` as a high-res PNG for shirt printing.
 * Produces TWO images per combo:
 *   - {comboId}-on-white.png  → dark text   (for white shirts)
 *   - {comboId}-on-black.png  → light text  (for black shirts)
 *
 * Uses `sharp` to convert inline SVG text to PNG — no native canvas build needed.
 *
 * Usage:  node scripts/render-text-designs.mjs
 */

import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ── Config ───────────────────────────────────────────────────────────

// Target print area: ~200mm wide × ~120mm tall at 300 DPI
// 200mm at 300 DPI ≈ 2362px, 120mm at 300 DPI ≈ 1417px
const CANVAS_WIDTH = 2400
const CANVAS_HEIGHT = 1400
const OUTPUT_DIR = resolve(ROOT, "assets/text-designs")

// ── Helpers ──────────────────────────────────────────────────────────

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Build an SVG string with centered multi-line text.
 * Long slogans are split at natural word breaks to fit.
 */
function buildSvg(text, textColor) {
  const words = text.split(/\s+/)
  const lines = []

  // Split into lines of ~3-4 words max for readability
  const maxWordsPerLine = Math.ceil(words.length / Math.ceil(words.length / 4))
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    lines.push(words.slice(i, i + maxWordsPerLine).join(" "))
  }

  // Dynamic font size: fewer/shorter lines → bigger text
  const maxLineLength = Math.max(...lines.map((l) => l.length))
  let fontSize = Math.min(200, Math.floor(CANVAS_WIDTH / (maxLineLength * 0.55)))
  fontSize = Math.max(80, fontSize) // floor at 80px

  const lineHeight = fontSize * 1.25
  const totalTextHeight = lines.length * lineHeight
  const startY = (CANVAS_HEIGHT - totalTextHeight) / 2 + fontSize * 0.35

  const textElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="${fontSize}" fill="${textColor}" letter-spacing="2">${escapeXml(line.toUpperCase())}</text>`
    })
    .join("\n    ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
    ${textElements}
  </svg>`
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  // 1. Load generated matrix
  const matrixPath = resolve(ROOT, "src/data/generated-matrix.json")
  if (!existsSync(matrixPath)) {
    console.error("❌  src/data/generated-matrix.json not found. Run `npm run generate:matrix` first.")
    process.exit(1)
  }

  const combos = JSON.parse(readFileSync(matrixPath, "utf-8"))
  const withText = combos.filter((c) => c.shirtText)

  if (withText.length === 0) {
    console.error("❌  No combos have shirtText. Re-run `npm run generate:matrix` to generate them.")
    process.exit(1)
  }

  console.log(`\n🎨  Rendering ${withText.length} designs (×2 color variants = ${withText.length * 2} PNGs)\n`)

  // 2. Ensure output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  let rendered = 0

  for (const combo of withText) {
    const { comboId, shirtText } = combo

    // Dark text for white shirt
    const svgDark = buildSvg(shirtText, "#1a1a1a")
    const darkPath = resolve(OUTPUT_DIR, `${comboId}-on-white.png`)
    await sharp(Buffer.from(svgDark))
      .png()
      .toFile(darkPath)

    // Light text for black shirt
    const svgLight = buildSvg(shirtText, "#f5f5f5")
    const lightPath = resolve(OUTPUT_DIR, `${comboId}-on-black.png`)
    await sharp(Buffer.from(svgLight))
      .png()
      .toFile(lightPath)

    rendered += 2
    console.log(`  ✓ ${comboId} — "${shirtText}"`)
  }

  console.log(`\n✅  Rendered ${rendered} PNGs to assets/text-designs/\n`)
}

main().catch((err) => {
  console.error("💥  Script failed:", err)
  process.exit(1)
})
