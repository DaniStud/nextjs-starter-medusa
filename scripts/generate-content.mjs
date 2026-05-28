/**
 * generate-content.mjs
 *
 * Reads src/data/keyword-matrix.json (output of the keyword pipeline),
 * generates SEO-optimized product descriptions for each combo via Gemini,
 * and writes the result to src/data/generated-matrix.json.
 *
 * Falls back to src/data/base-matrix.json if keyword-matrix.json doesn't exist.
 *
 * Usage:  node --env-file=.env.local scripts/generate-content.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { GoogleGenerativeAI } from "@google/generative-ai"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

// ── Config ───────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error("❌  GEMINI_API_KEY is not set. Add it to .env.local")
  process.exit(1)
}

const DELAY_MS = 1500 // pause between API calls to respect rate limits

// ── Helpers ──────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  // 1. Load combos — prefer keyword-matrix (has SEO data), fall back to base-matrix
  const keywordMatrixPath = resolve(ROOT, "src/data/keyword-matrix.json")
  const baseMatrixPath = resolve(ROOT, "src/data/base-matrix.json")

  let combos = []

  if (existsSync(keywordMatrixPath)) {
    const keywordMatrix = JSON.parse(readFileSync(keywordMatrixPath, "utf-8"))
    console.log(`\n📦  Loaded ${keywordMatrix.length} combos from keyword-matrix.json (SEO mode)\n`)

    combos = keywordMatrix.map((item) => ({
      comboId: item.comboId,
      role: item.role,
      roleId: item.roleId,
      passion: item.passion,
      passionId: item.passionId,
      bestKeyword: item.bestKeyword,
      bestVolume: item.bestVolume,
    }))
  } else {
    const matrix = JSON.parse(readFileSync(baseMatrixPath, "utf-8"))
    const { roles, passions } = matrix
    console.log(
      `\n📦  Loaded ${roles.length} roles × ${passions.length} passions = ${roles.length * passions.length} combos (basic mode)\n`
    )
    for (const role of roles) {
      for (const passion of passions) {
        combos.push({
          comboId: slugify(`${role.name}-${passion.name}`),
          role: role.name,
          roleId: role.id,
          passion: passion.name,
          passionId: passion.id,
          bestKeyword: null,
          bestVolume: 0,
        })
      }
    }
  }

  // 2. Init Gemini
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  // 3. Generate descriptions for each combo
  const results = []
  const total = combos.length

  for (let index = 0; index < total; index++) {
    const combo = combos[index]
    const title = `${combo.role} × ${combo.passion}`

    console.log(`[${index + 1}/${total}] Generating: ${title}...`)

    // SEO-aware prompt: include bestKeyword when available
    const seoHint = combo.bestKeyword
      ? ` Naturally incorporate the phrase "${combo.bestKeyword}" for SEO.`
      : ""

    const prompt = `You are writing for a print-on-demand t-shirt brand. For a "${combo.role}" who loves "${combo.passion}", produce JSON with two fields:
1. "description": a compelling ~150-character product description for the t-shirt page.${seoHint} No emojis.
2. "shirtText": a short, punchy slogan (max 6 words) to print on the shirt. Make it quirky, fun, cute, or cheeky. Examples of good shirt text: "Don't Talk To Me Before Coffee", "Cats Over People", "Probably Thinking About Dogs". No emojis. No hashtags.

Respond with ONLY valid JSON, no markdown fences.`

    const response = await model.generateContent(prompt)
    const rawText = response.response.text().trim()

    // Parse JSON response — strip markdown fences if present
    let description, shirtText
    try {
      const cleaned = rawText.replace(/^```json\s*/, "").replace(/```\s*$/, "")
      const parsed = JSON.parse(cleaned)
      description = parsed.description?.trim() || ""
      shirtText = parsed.shirtText?.trim() || ""
    } catch {
      // Fallback: use entire response as description, empty shirtText
      console.warn(`  ⚠ JSON parse failed, using raw text as description`)
      description = rawText.slice(0, 200)
      shirtText = ""
    }

    results.push({
      comboId: combo.comboId,
      role: combo.role,
      roleId: combo.roleId,
      passion: combo.passion,
      passionId: combo.passionId,
      iconMapKey: null,
      title,
      bestKeyword: combo.bestKeyword,
      bestVolume: combo.bestVolume,
      description,
      shirtText,
    })

    // Rate-limit: wait before next call (skip delay on last item)
    if (index < total - 1) {
      await sleep(DELAY_MS)
    }
  }

  // 4. Write output
  const outputPath = resolve(ROOT, "src/data/generated-matrix.json")
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8")

  console.log(`\n✅  Wrote ${results.length} combos to src/data/generated-matrix.json\n`)
}

main().catch((err) => {
  console.error("💥  Script failed:", err)
  process.exit(1)
})
