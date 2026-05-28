import { Metadata } from "next"
import generatedMatrix from "@data/generated-matrix.json"
import { IconDictionary } from "../../utils/iconMap"

export const metadata: Metadata = {
  title: "MVP Product Matrix — Pet Niche",
  description:
    "Programmatically generated SEO-optimized product combinations for pet lovers",
}

type Combo = {
  comboId: string
  role: string
  roleId: string
  passion: string
  passionId: string
  iconMapKey: string | null
  title: string
  bestKeyword?: string | null
  bestVolume?: number
  description: string
  shirtText?: string
}

export default function MvpTestPage() {
  const combos = generatedMatrix as Combo[]

  return (
    <div className="content-container py-12">
      {/* Header */}
      <div className="flex flex-col gap-y-2 mb-10">
        <h1 className="text-2xl font-heading font-bold uppercase tracking-wide text-ui-fg-base">
          MVP Product Matrix
        </h1>
        <div className="flex gap-3 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-ui-bg-subtle px-3 py-1 text-sm font-medium text-ui-fg-muted">
            {combos.length} products generated
          </span>
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
            {combos.filter((c) => c.bestVolume && c.bestVolume > 0).length} with
            SEO data
          </span>
        </div>
      </div>

      {/* Grid */}
      <ul className="grid grid-cols-1 small:grid-cols-2 medium:grid-cols-3 gap-6">
        {combos.map((combo) => (
          <li
            key={combo.comboId}
            className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-5 shadow-sm"
          >
            {/* Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-ui-bg-subtle text-ui-fg-muted">
              {combo.iconMapKey && IconDictionary[combo.iconMapKey] ? (
                (() => {
                  const DynamicIcon = IconDictionary[combo.iconMapKey!]
                  return <DynamicIcon width={50} height={50} />
                })()
              ) : (
                <span className="text-2xl">
                  {combo.passion === "Wine" && "🍷"}
                  {combo.passion === "Coffee" && "☕"}
                  {combo.passion === "Gardening" && "🌱"}
                  {combo.passion === "Reading" && "📚"}
                  {combo.passion === "Yoga" && "🧘"}
                  {combo.passion === "Knitting" && "🧶"}
                  {combo.passion === "Hiking" && "🥾"}
                  {combo.passion === "Cooking" && "👩‍🍳"}
                  {combo.passion === "True Crime" && "🔍"}
                  {combo.passion === "Napping" && "😴"}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-base font-heading font-bold uppercase tracking-wide text-ui-fg-base">
              {combo.title}
            </h2>

            {/* Shirt text (design slogan) */}
            {combo.shirtText && (
              <p className="text-sm font-bold text-ui-fg-interactive italic">
                &ldquo;{combo.shirtText}&rdquo;
              </p>
            )}

            {/* SEO keyword badge */}
            {combo.bestKeyword && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  🔑 {combo.bestKeyword}
                </span>
                {combo.bestVolume ? (
                  <span className="text-xs text-ui-fg-muted">
                    {combo.bestVolume.toLocaleString()}/mo
                  </span>
                ) : null}
              </div>
            )}

            {/* Proof-of-concept string */}
            <p className="text-sm italic text-ui-fg-subtle">
              {combo.role} who runs on {combo.passion}
            </p>

            {/* AI description */}
            <p className="text-sm text-ui-fg-base leading-relaxed">
              {combo.description}
            </p>

            {/* Slug */}
            <span className="mt-auto text-xs font-mono text-ui-fg-muted">
              /{combo.comboId}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
