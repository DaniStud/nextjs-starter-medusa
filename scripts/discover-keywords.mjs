/**
 * discover-keywords.mjs
 *
 * Stage 1: Keyword Discovery via Google Autocomplete
 *
 * For each role × passion combo, queries Google Suggest with multiple
 * seed phrases and collects real long-tail search queries.
 *
 * Usage:  node scripts/discover-keywords.mjs
 *         (no env vars or API keys needed)
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

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

/**
 * Hit Google Autocomplete (Suggest) endpoint.
 * Returns an array of suggestion strings.
 * Uses the Firefox client format which returns clean JSON.
 */
async function autocomplete(query) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&gl=us&hl=en`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ⚠ Autocomplete returned ${res.status} for "${query}"`)
      return []
    }
    const data = await res.json()
    // Response format: [query, [suggestions]]
    return data[1] || []
  } catch (err) {
    console.warn(`  ⚠ Autocomplete failed for "${query}": ${err.message}`)
    return []
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const matrixPath = resolve(ROOT, "src/data/pet-niche-matrix.json")
  const matrix = JSON.parse(readFileSync(matrixPath, "utf-8"))
  const { roles, passions } = matrix
  const total = roles.length * passions.length

  console.log(
    `\n🔍 Discovering keywords for ${roles.length} roles × ${passions.length} passions = ${total} combos\n`
  )

  const results = []
  let i = 0

  for (const role of roles) {
    for (const passion of passions) {
      i++
      const comboId = slugify(`${role.name}-${passion.name}`)
      console.log(`[${i}/${total}] ${role.name} × ${passion.name}`)

      // Multiple seed phrases — mix broad and specific patterns
      // Google Autocomplete works better with shorter, natural queries
      const roleLower = role.name.toLowerCase()
      const passionLower = passion.name.toLowerCase()
      const seeds = [
        // Broad role-based queries
        `${roleLower} gift`,
        `${roleLower} shirt`,
        `${roleLower} t-shirt`,
        `funny ${roleLower}`,
        `${roleLower} ${passionLower}`,
        // Passion-based queries with pet context
        `${passionLower} ${roleLower}`,
        `${passionLower} cat lover`,
        `${passionLower} dog lover`,
        // Gift intent queries
        `gift for ${roleLower}`,
        `gifts for ${passionLower} lovers`,
      ]

      const allSuggestions = []
      for (const seed of seeds) {
        const suggestions = await autocomplete(seed)
        allSuggestions.push(...suggestions)
        await sleep(300) // be polite to Google
      }

      // Deduplicate and lowercase
      const unique = [
        ...new Set(allSuggestions.map((s) => s.toLowerCase().trim())),
      ]

      console.log(`  → ${unique.length} unique suggestions`)

      results.push({
        comboId,
        role: role.name,
        roleId: role.id,
        passion: passion.name,
        passionId: passion.id,
        seeds,
        suggestions: unique,
        topKeyword: unique[0] || `${role.name} ${passion.name} gift`,
      })

      // Pause between combos to avoid throttling
      await sleep(500)
    }
  }

  const outPath = resolve(ROOT, "src/data/keyword-discovery.json")
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8")

  const totalSuggestions = results.reduce(
    (sum, r) => sum + r.suggestions.length,
    0
  )
  console.log(
    `\n✅ Wrote ${results.length} combos (${totalSuggestions} total suggestions) to src/data/keyword-discovery.json\n`
  )
}

main().catch((err) => {
  console.error("💥 Script failed:", err)
  process.exit(1)
})
