/**
 * validate-volume.mjs
 *
 * Stage 2: Keyword Volume Validation via DataForSEO
 *
 * Reads keyword-discovery.json, sends all unique suggestions to
 * DataForSEO Google Ads Search Volume API, and writes a ranked
 * keyword-matrix.json with volume, competition, and CPC data.
 *
 * Usage:  node --env-file=.env.local scripts/validate-volume.mjs
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

const DATAFORSEO_AUTH = process.env.DATAFORSEO_AUTH

// ── Helpers ──────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * DataForSEO Google Ads Search Volume (Live)
 * - Up to 1000 keywords per request (flat price per request)
 * - Max 12 requests/min on Google Ads Live endpoints
 * - No location = worldwide results
 *
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 */
async function getSearchVolume(keywords) {
  const res = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${DATAFORSEO_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords,
          language_code: "en",
          // no location_code → worldwide results
          sort_by: "search_volume",
        },
      ]),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DataForSEO API error (${res.status}): ${text}`)
  }

  return res.json()
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  if (!DATAFORSEO_AUTH) {
    console.error("❌ DATAFORSEO_AUTH is not set. Add it to .env.local")
    console.error(
      '   Format: Base64 of "email:password" → e.g. amVsbHlsb3JkOUBnbWFpbC5jb206...'
    )
    process.exit(1)
  }

  const discoveryPath = resolve(ROOT, "src/data/keyword-discovery.json")
  const discovery = JSON.parse(readFileSync(discoveryPath, "utf-8"))

  // Collect ALL unique suggestions across every combo
  // Filter out empty/invalid keywords (must be 1-80 chars, max 10 words, ASCII only)
  const allKeywords = [
    ...new Set(discovery.flatMap((d) => d.suggestions)),
  ].filter((kw) => {
    if (!kw || kw.trim().length === 0) return false
    if (kw.length > 80) return false
    if (kw.split(/\s+/).length > 10) return false
    // DataForSEO rejects non-ASCII characters (é, ñ, etc.)
    if (!/^[\x20-\x7E]+$/.test(kw)) return false
    return true
  })

  console.log(
    `\n📊 Validating ${allKeywords.length} unique keywords via DataForSEO...\n`
  )

  // Build a map: keyword → { volume, competition, competitionIndex, cpc }
  const volumeMap = new Map()

  // Batch in chunks of 1000 (DataForSEO max per request)
  for (let i = 0; i < allKeywords.length; i += 1000) {
    const batch = allKeywords.slice(i, i + 1000)
    const batchNum = Math.floor(i / 1000) + 1
    const totalBatches = Math.ceil(allKeywords.length / 1000)

    console.log(
      `  Batch ${batchNum}/${totalBatches}: ${batch.length} keywords...`
    )

    const response = await getSearchVolume(batch)

    if (response.tasks_error > 0) {
      const task = response?.tasks?.[0]
      console.warn(
        `  ⚠ Task error — status: ${task?.status_code}, message: ${task?.status_message}`
      )
      if (task?.status_code !== 20000) {
        console.warn(`  Full task response:`, JSON.stringify(task, null, 2).slice(0, 500))
      }
    }

    const cost = response.cost || 0
    console.log(`  → Cost: $${cost.toFixed(4)}`)

    const results = response?.tasks?.[0]?.result || []

    for (const item of results) {
      if (item.keyword) {
        volumeMap.set(item.keyword, {
          volume: item.search_volume,
          competition: item.competition,
          competitionIndex: item.competition_index,
          cpc: item.cpc,
          lowBid: item.low_top_of_page_bid,
          highBid: item.high_top_of_page_bid,
        })
      }
    }

    // Respect 12 req/min limit — wait 6s between batches
    if (i + 1000 < allKeywords.length) {
      console.log("  ⏳ Waiting 6s (rate limit)...")
      await sleep(6000)
    }
  }

  console.log(`\n  📈 Got volume data for ${volumeMap.size} keywords\n`)

  // Merge volume data back into each combo, rank by volume
  const results = discovery.map((combo) => {
    const ranked = combo.suggestions
      .map((kw) => ({
        keyword: kw,
        volume: 0,
        competition: null,
        competitionIndex: null,
        cpc: 0,
        ...(volumeMap.get(kw) || {}),
      }))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))

    const best = ranked[0] || {}

    return {
      comboId: combo.comboId,
      role: combo.role,
      roleId: combo.roleId,
      passion: combo.passion,
      passionId: combo.passionId,
      bestKeyword: best.keyword || `${combo.role} ${combo.passion} gift`,
      bestVolume: best.volume || 0,
      bestCompetition: best.competition || null,
      bestCpc: best.cpc || 0,
      allKeywords: ranked,
    }
  })

  // Sort combos by best volume (highest first) for easy review
  results.sort((a, b) => b.bestVolume - a.bestVolume)

  const outPath = resolve(ROOT, "src/data/keyword-matrix.json")
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8")

  // Print summary table
  console.log("┌─────────────────────────────────────────────────────────┐")
  console.log("│  Top combos by search volume                           │")
  console.log("├──────────────────────────┬────────┬─────────┬──────────┤")
  console.log("│ Combo                    │ Volume │ Compet. │ Best KW  │")
  console.log("├──────────────────────────┼────────┼─────────┼──────────┤")

  for (const r of results.slice(0, 15)) {
    const combo = `${r.role} × ${r.passion}`.padEnd(24)
    const vol = String(r.bestVolume).padStart(6)
    const comp = (r.bestCompetition || "n/a").toString().padEnd(7)
    const kw =
      r.bestKeyword.length > 8
        ? r.bestKeyword.slice(0, 8) + "…"
        : r.bestKeyword.padEnd(9)
    console.log(`│ ${combo} │ ${vol} │ ${comp} │ ${kw}│`)
  }

  console.log("└──────────────────────────┴────────┴─────────┴──────────┘")
  console.log(
    `\n✅ Wrote ${results.length} combos to src/data/keyword-matrix.json\n`
  )
}

main().catch((err) => {
  console.error("💥 Script failed:", err)
  process.exit(1)
})
