import { Metadata } from "next"
import generatedMatrix from "@data/generated-matrix.json"
import { IconDictionary } from "../../utils/iconMap"

export const metadata: Metadata = {
  title: "MVP Product Matrix",
  description:
    "Proof-of-concept: programmatically generated product combinations",
}

type Combo = {
  comboId: string
  role: string
  roleId: string
  passion: string
  passionId: string
  iconMapKey: string | null
  title: string
  description: string
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
        <span className="inline-flex items-center self-start rounded-full bg-ui-bg-subtle px-3 py-1 text-sm font-medium text-ui-fg-muted">
          {combos.length} products generated
        </span>
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
                <span className="text-xs">[Icon Missing]</span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-base font-heading font-bold uppercase tracking-wide text-ui-fg-base">
              {combo.title}
            </h2>

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
