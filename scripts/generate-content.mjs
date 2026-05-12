/**
 * generate-content.mjs
 *
 * Reads src/data/base-matrix.json, cross-multiplies roles × passions,
 * generates a product description for each combo via Gemini,
 * and writes the result to src/data/generated-matrix.json.
 *
 * Usage:  node --env-file=.env.local scripts/generate-content.mjs
 */

import { readFileSync, writeFileSync } from "node:fs"
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

const DELAY_MS = 1000 // pause between API calls to respect rate limits

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
  // 1. Read input matrix
  const matrixPath = resolve(ROOT, "src/data/base-matrix.json")
  const matrix = JSON.parse(readFileSync(matrixPath, "utf-8"))
  const { roles, passions } = matrix

  console.log(
    `\n📦  Loaded ${roles.length} roles × ${passions.length} passions = ${roles.length * passions.length} combos\n`
  )

  // 2. Init Gemini
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  // 3. Cross-multiply and generate descriptions
  const results = []
  let index = 0
  const total = roles.length * passions.length

  for (const role of roles) {
    for (const passion of passions) {
      index++
      const comboId = slugify(`${role.name}-${passion.name}`)
      const title = `${role.name} × ${passion.name}`

      console.log(`[${index}/${total}] Generating: ${title}...`)

      const prompt = `Write a 150-character product description for a quirky gift designed for a ${role.name} who loves ${passion.name}. Do not use emojis. Output only the description text.`

      const response = await model.generateContent(prompt)
      const description = response.response.text().trim()

      results.push({
        comboId,
        role: role.name,
        roleId: role.id,
        passion: passion.name,
        passionId: passion.id,
        iconMapKey: passion.iconMapKey,
        title,
        description,
      })

      // Rate-limit: wait before next call (skip delay on last item)
      if (index < total) {
        await sleep(DELAY_MS)
      }
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
