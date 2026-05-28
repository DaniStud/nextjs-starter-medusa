import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles, QuestionMarkCircle, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
  Toaster,
  Badge,
  Checkbox,
} from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Types matching the admin API responses
// (see src/api/admin/shirtplatform/*)
// ---------------------------------------------------------------------------

type BaseProductSummary = {
  id: number
  name: string
  active: boolean
}

type BaseProductDetail = {
  id: number
  name: string
  description?: string
  active: boolean
  colors: { id: number; name: string; hexCode?: string }[]
  sizes: { id: number; name: string }[]
  availableColorIds: number[]
  availableSizeIds: number[]
  skuMatrix: { colorId: number; sizeId: number; sku: string }[]
  views: { id: number; position: string; defaultView: boolean }[]
  basePriceEur: number
}

type MotiveUploadResult = {
  url: string
  key?: string | null
  filename: string
  mime_type: string
}

type WizardStep = 1 | 2 | 3 | 4

const CURRENCIES = ["eur", "usd", "gbp", "chf", "sek", "dkk", "nok", "pln", "czk"]

// ---------------------------------------------------------------------------
// API helpers — admin routes are session-cookie authenticated by Medusa
// ---------------------------------------------------------------------------

async function apiJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
  }
  return json as T
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.replace(/^data:[^;]+;base64,/, ""))
    }
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"))
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const NewShirtplatformProductPage = () => {
  // ---------- wizard state ----------
  const [step, setStep] = useState<WizardStep>(1)

  // step 1: base product picker
  const [search, setSearch] = useState("")
  const [summaries, setSummaries] = useState<BaseProductSummary[]>([])
  const [summariesLoading, setSummariesLoading] = useState(false)
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null)

  // step 2: colors & sizes
  const [detail, setDetail] = useState<BaseProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedColorIds, setSelectedColorIds] = useState<Set<number>>(new Set())
  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<number>>(new Set())

  // step 3: motive
  const [motiveFile, setMotiveFile] = useState<File | null>(null)
  const [motivePreview, setMotivePreview] = useState<string | null>(null)
  const [motive, setMotive] = useState<MotiveUploadResult | null>(null)
  const [motiveUploading, setMotiveUploading] = useState(false)
  const [viewPosition, setViewPosition] = useState<"FRONT" | "BACK" | "BOTH">("FRONT")
  const [positionTop, setPositionTop] = useState("")
  const [positionLeft, setPositionLeft] = useState("")
  const [positionRight, setPositionRight] = useState("")
  const [skipMotive, setSkipMotive] = useState(false)
  const [showMotiveHelp, setShowMotiveHelp] = useState(false)

  // step 4: product metadata
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [priceMajor, setPriceMajor] = useState("")
  const [currency, setCurrency] = useState("eur")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ---------- step 1: load summaries on mount ----------
  useEffect(() => {
    let cancelled = false
    setSummariesLoading(true)
    apiJson<{ base_products: BaseProductSummary[] }>(
      "/admin/shirtplatform/base-products"
    )
      .then((res) => {
        if (!cancelled) setSummaries(res.base_products)
      })
      .catch((err) => toast.error(`Failed to load base products: ${err.message}`))
      .finally(() => {
        if (!cancelled) setSummariesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return summaries
    return summaries.filter((s) => s.name.toLowerCase().includes(q))
  }, [search, summaries])

  // ---------- step 2: load detail when a base product is picked ----------
  useEffect(() => {
    if (selectedBaseId == null) return
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    apiJson<{ base_product: BaseProductDetail }>(
      `/admin/shirtplatform/base-products/${selectedBaseId}`
    )
      .then((res) => {
        if (cancelled) return
        setDetail(res.base_product)
        // Pre-fill defaults
        setTitle((t) => t || res.base_product.name)
        setSelectedColorIds(new Set())
        setSelectedSizeIds(new Set())
      })
      .catch((err) => toast.error(`Failed to load product detail: ${err.message}`))
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBaseId])

  // ---------- SKU matrix lookup helpers ----------
  const skuLookup = useMemo(() => {
    const map = new Map<string, string>()
    detail?.skuMatrix.forEach((s) => map.set(`${s.colorId}:${s.sizeId}`, s.sku))
    return map
  }, [detail])

  const availableCombinationsCount = useMemo(() => {
    let n = 0
    for (const c of selectedColorIds) {
      for (const s of selectedSizeIds) {
        if (skuLookup.has(`${c}:${s}`)) n++
      }
    }
    return n
  }, [selectedColorIds, selectedSizeIds, skuLookup])

  // ---------- step 3: motive upload ----------
  const ALLOWED_MOTIVE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"]
  const MAX_MOTIVE_SIZE_MB = 18

  const onMotiveSelected = async (file: File) => {
    // Client-side validation
    if (!ALLOWED_MOTIVE_TYPES.includes(file.type)) {
      toast.error(`Unsupported file type "${file.type || "unknown"}". Use PNG, JPG, or SVG.`)
      return
    }
    if (file.size > MAX_MOTIVE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_MOTIVE_SIZE_MB} MB.`)
      return
    }

    setMotiveFile(file)
    setMotive(null)
    setMotivePreview(URL.createObjectURL(file))
    setMotiveUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await apiJson<{ motive: MotiveUploadResult }>(
        "/admin/shirtplatform/motives",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type || "image/png",
            content_base64: base64,
          }),
        }
      )
      setMotive(res.motive)
      toast.success("Motive uploaded")
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
      setMotive(null)
    } finally {
      setMotiveUploading(false)
    }
  }

  // ---------- step 4: submit ----------
  const submit = async () => {
    if (!detail) return
    const amountMinor = Math.round(Number(priceMajor) * 100)
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      toast.error("Enter a valid price")
      return
    }
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!skipMotive && !motive?.url) {
      toast.error("Upload a motive or check 'No motive (plain base shirt)'")
      return
    }

    setSubmitting(true)
    try {
      const body: any = {
        sp_product_id: detail.id,
        color_ids: [...selectedColorIds],
        size_ids: [...selectedSizeIds],
        product: {
          title: title.trim(),
          handle: handle.trim() || undefined,
          description: description.trim() || undefined,
          status,
        },
        prices: [{ amount: amountMinor, currency_code: currency }],
      }
      if (!skipMotive && motive) {
        body.motive = {
          url: motive.url,
          filename: motive.filename,
          view_position: viewPosition,
          position_top: positionTop || undefined,
          position_left: positionLeft || undefined,
          position_right: positionRight || undefined,
        }
      }

      const res = await apiJson<{
        product: { id: string; title: string }
        skipped_combinations: { color_id: number; size_id: number; reason: string }[]
      }>("/admin/shirtplatform/products", {
        method: "POST",
        body: JSON.stringify(body),
      })

      const skippedNote =
        res.skipped_combinations.length > 0
          ? ` (${res.skipped_combinations.length} color/size combos skipped — no SP SKU)`
          : ""
      toast.success(`Created "${res.product.title}"${skippedNote}`)

      // Reset wizard
      setStep(1)
      setSearch("")
      setSelectedBaseId(null)
      setDetail(null)
      setSelectedColorIds(new Set())
      setSelectedSizeIds(new Set())
      setMotiveFile(null)
      setMotive(null)
      setMotivePreview(null)
      setTitle("")
      setHandle("")
      setDescription("")
      setPriceMajor("")
      setSkipMotive(false)
    } catch (err: any) {
      toast.error(`Create failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- navigation guards ----------
  const canGoNext: Record<WizardStep, boolean> = {
    1: selectedBaseId != null,
    2:
      detail != null &&
      selectedColorIds.size > 0 &&
      selectedSizeIds.size > 0 &&
      availableCombinationsCount > 0,
    3: skipMotive || Boolean(motive?.url),
    4: false,
  }

  // ---------- render ----------
  return (
    <Container className="divide-y p-0">
      <Toaster />
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Create Shirtplatform product</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Pick a base shirt, choose colors & sizes, upload a motive, set price.
          </Text>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* --- Step 1 ---------------------------------------------------- */}
      {step === 1 && (
        <div className="px-6 py-6 space-y-4">
          <Heading level="h2">1 · Pick a base shirt</Heading>
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {summariesLoading ? (
            <Text>Loading base catalog…</Text>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y border rounded">
              {filteredSummaries.length === 0 && (
                <div className="px-3 py-4 text-ui-fg-subtle">No base products match.</div>
              )}
              {filteredSummaries.map((p) => {
                const selected = selectedBaseId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedBaseId(p.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-ui-bg-base-hover ${
                      selected ? "bg-ui-bg-highlight" : ""
                    }`}
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-ui-fg-subtle ml-2">#{p.id}</span>
                    </span>
                    {selected && <Badge color="green">Selected</Badge>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* --- Step 2 ---------------------------------------------------- */}
      {step === 2 && (
        <div className="px-6 py-6 space-y-6">
          <Heading level="h2">2 · Colors & sizes</Heading>
          {detailLoading || !detail ? (
            <Text>Loading colors & sizes…</Text>
          ) : (
            <>
              <Text size="small" className="text-ui-fg-subtle">
                Base price on Shirtplatform: <b>{detail.basePriceEur.toFixed(2)} EUR</b> · SKUs
                available: <b>{detail.skuMatrix.length}</b>
                {detail.colors.length !== (detail.availableColorIds ?? detail.colors.map(c => c.id)).length && (
                  <> · <span className="text-ui-fg-muted">{detail.colors.length - (detail.availableColorIds ?? detail.colors.map(c => c.id)).length} colors hidden (no SKU)</span></>
                )}
              </Text>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="font-medium">Colors</Label>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedColorIds(new Set(detail.availableColorIds ?? detail.colors.map(c => c.id)))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedColorIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {detail.colors
                      .filter((c) => (detail.availableColorIds ?? detail.colors.map(x => x.id)).includes(c.id))
                      .map((c) => {
                      const checked = selectedColorIds.has(c.id)
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-ui-bg-base-hover cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedColorIds)
                              if (v) next.add(c.id)
                              else next.delete(c.id)
                              setSelectedColorIds(next)
                            }}
                          />
                          {c.hexCode && (
                            <span
                              className="inline-block w-4 h-4 rounded border"
                              style={{ background: `#${c.hexCode.replace(/^#/, "")}` }}
                            />
                          )}
                          <span>{c.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="font-medium">Sizes</Label>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedSizeIds(new Set(detail.availableSizeIds ?? detail.sizes.map(s => s.id)))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedSizeIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                    {detail.sizes
                      .filter((s) => (detail.availableSizeIds ?? detail.sizes.map(x => x.id)).includes(s.id))
                      .map((s) => {
                      const checked = selectedSizeIds.has(s.id)
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-ui-bg-base-hover cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedSizeIds)
                              if (v) next.add(s.id)
                              else next.delete(s.id)
                              setSelectedSizeIds(next)
                            }}
                          />
                          <span>{s.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              </div>

              {selectedColorIds.size > 0 && selectedSizeIds.size > 0 && (
                <SkuCoverage
                  detail={detail}
                  selectedColorIds={selectedColorIds}
                  selectedSizeIds={selectedSizeIds}
                  available={availableCombinationsCount}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* --- Step 3 ---------------------------------------------------- */}
      {step === 3 && (
        <div className="px-6 py-6 space-y-4">
          <Heading level="h2">3 · Motive (design)</Heading>

          {/* Shirt preview + motive thumbnail */}
          {detail && selectedColorIds.size > 0 && (
            <div className="flex gap-4 items-start flex-wrap">
              {(viewPosition === "FRONT" || viewPosition === "BOTH") && (
                <div className="text-center">
                  <Text size="small" className="text-ui-fg-subtle mb-1">Front</Text>
                  <img
                    src={`/admin/shirtplatform/preview?product_id=${detail.id}&color_id=${[...selectedColorIds][0]}&view=FRONT&_t=${detail.id}`}
                    alt="Front preview"
                    className="max-h-48 rounded border bg-ui-bg-subtle"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                </div>
              )}
              {(viewPosition === "BACK" || viewPosition === "BOTH") && (
                <div className="text-center">
                  <Text size="small" className="text-ui-fg-subtle mb-1">Back</Text>
                  <img
                    src={`/admin/shirtplatform/preview?product_id=${detail.id}&color_id=${[...selectedColorIds][0]}&view=BACK&_t=${detail.id}`}
                    alt="Back preview"
                    className="max-h-48 rounded border bg-ui-bg-subtle"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                </div>
              )}
              {viewPosition !== "FRONT" && viewPosition !== "BACK" && viewPosition !== "BOTH" && (
                <div className="text-center">
                  <img
                    src={`/admin/shirtplatform/preview?product_id=${detail.id}&color_id=${[...selectedColorIds][0]}&view=${viewPosition}&_t=${detail.id}`}
                    alt="Preview"
                    className="max-h-48 rounded border bg-ui-bg-subtle"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                </div>
              )}
              {motivePreview && (
                <div className="text-center">
                  <Text size="small" className="text-ui-fg-subtle mb-1">Motive</Text>
                  <img src={motivePreview} alt="Motive" className="max-h-48 rounded border bg-ui-bg-subtle" />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <Checkbox
              checked={skipMotive}
              onCheckedChange={(v) => {
                setSkipMotive(Boolean(v))
                if (v) {
                  setMotive(null)
                  setMotiveFile(null)
                  setMotivePreview(null)
                }
              }}
            />
            <span>No motive — sell as plain base shirt</span>
          </label>

          {!skipMotive && (
            <>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void onMotiveSelected(f)
                  }}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={motiveUploading}
                >
                  {motiveUploading ? "Uploading…" : motive ? "Replace motive" : "Choose file"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowMotiveHelp((v) => !v)}
                  className="text-ui-fg-muted hover:text-ui-fg-subtle transition-colors"
                  title="Image requirements"
                >
                  <QuestionMarkCircle className="w-5 h-5" />
                </button>
                {motiveFile && (
                  <Text size="small" className="text-ui-fg-subtle">
                    {motiveFile.name} ({Math.round(motiveFile.size / 1024)} KB)
                  </Text>
                )}
                {motive?.url && <Badge color="green">Uploaded</Badge>}
                {motiveFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setMotiveFile(null)
                      setMotive(null)
                      setMotivePreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    className="text-ui-fg-muted hover:text-ui-fg-error transition-colors"
                    title="Remove motive"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showMotiveHelp && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4 text-sm space-y-2">
                  <p className="font-medium">Motive image requirements</p>
                  <ul className="list-disc pl-5 space-y-1 text-ui-fg-subtle">
                    <li><b>Formats:</b> PNG, JPG/JPEG, or SVG</li>
                    <li><b>Max file size:</b> 18 MB</li>
                    <li><b>Recommended resolution:</b> at least 2000×2000 px for sharp prints</li>
                    <li><b>Transparency:</b> use PNG or SVG if your design has transparent areas</li>
                    <li><b>Color mode:</b> RGB (CMYK will be converted automatically)</li>
                    <li><b>SVG:</b> make sure all fonts are converted to outlines/paths</li>
                  </ul>
                  <p className="text-ui-fg-muted text-xs pt-1">
                    Tip: higher resolution = better print quality. Avoid upscaling small images.
                  </p>
                </div>
              )}



              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <Label>View</Label>
                  <Select
                    value={viewPosition}
                    onValueChange={(v) => setViewPosition(v as "FRONT" | "BACK" | "BOTH")}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {(detail?.views ?? []).map((v) => (
                        <Select.Item key={v.position} value={v.position.toUpperCase()}>
                          {v.position}
                        </Select.Item>
                      ))}
                      {(detail?.views?.length ?? 0) > 1 && (
                        <Select.Item value="BOTH">Both (Front + Back)</Select.Item>
                      )}
                      {(detail?.views?.length ?? 0) === 0 && (
                        <>
                          <Select.Item value="FRONT">Front</Select.Item>
                          <Select.Item value="BACK">Back</Select.Item>
                        </>
                      )}
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label>Top offset (mm)</Label>
                  <Input
                    value={positionTop}
                    onChange={(e) => setPositionTop(e.target.value)}
                    placeholder="auto"
                  />
                </div>
                <div>
                  <Label>Left margin (mm)</Label>
                  <Input
                    value={positionLeft}
                    onChange={(e) => setPositionLeft(e.target.value)}
                    placeholder="auto"
                  />
                </div>
                <div>
                  <Label>Right margin (mm)</Label>
                  <Input
                    value={positionRight}
                    onChange={(e) => setPositionRight(e.target.value)}
                    placeholder="auto"
                  />
                </div>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                Leave offsets blank to center the motive automatically. Set <i>both</i> Left and
                Right to fix the motive width.
              </Text>
            </>
          )}
        </div>
      )}

      {/* --- Step 4 ---------------------------------------------------- */}
      {step === 4 && (
        <div className="px-6 py-6 space-y-4">
          <Heading level="h2">4 · Product details</Heading>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Handle (optional)</Label>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="auto-generated from title"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Price ({currency.toUpperCase()})</Label>
              <Input
                value={priceMajor}
                onChange={(e) => setPriceMajor(e.target.value)}
                placeholder="24.99"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {CURRENCIES.map((c) => (
                    <Select.Item key={c} value={c}>
                      {c.toUpperCase()}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "draft" | "published")}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="draft">Draft</Select.Item>
                  <Select.Item value="published">Published</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>

          <ReviewSummary
            detail={detail}
            colorCount={selectedColorIds.size}
            sizeCount={selectedSizeIds.size}
            variantCount={availableCombinationsCount}
            motive={motive}
            skipMotive={skipMotive}
          />
        </div>
      )}

      {/* --- Nav -------------------------------------------------------- */}
      <div className="flex items-center justify-between px-6 py-4">
        <Button
          variant="secondary"
          disabled={step === 1 || submitting}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
        >
          Back
        </Button>
        {step < 4 ? (
          <Button
            disabled={!canGoNext[step]}
            onClick={() => setStep((s) => ((s + 1) as WizardStep))}
          >
            Next
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create product"}
          </Button>
        )}
      </div>
    </Container>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: WizardStep }) {
  const labels = ["Base", "Colors/Sizes", "Motive", "Details"]
  return (
    <div className="flex gap-2">
      {labels.map((l, i) => {
        const active = step === i + 1
        const done = step > i + 1
        return (
          <Badge
            key={l}
            color={done ? "green" : active ? "blue" : "grey"}
          >
            {i + 1}. {l}
          </Badge>
        )
      })}
    </div>
  )
}

function SkuCoverage({
  detail,
  selectedColorIds,
  selectedSizeIds,
  available,
}: {
  detail: BaseProductDetail
  selectedColorIds: Set<number>
  selectedSizeIds: Set<number>
  available: number
}) {
  const total = selectedColorIds.size * selectedSizeIds.size
  const missing = total - available
  return (
    <div className="border rounded p-3 bg-ui-bg-subtle text-sm">
      Will create <b>{available}</b> variant{available === 1 ? "" : "s"} out of{" "}
      {total} selected combinations.
      {missing > 0 && (
        <Text size="small" className="text-ui-fg-subtle mt-1">
          {missing} combination{missing === 1 ? "" : "s"} skipped — no Shirtplatform SKU
          exists for those color/size pairs.
        </Text>
      )}
    </div>
  )
}

function ReviewSummary({
  detail,
  colorCount,
  sizeCount,
  variantCount,
  motive,
  skipMotive,
}: {
  detail: BaseProductDetail | null
  colorCount: number
  sizeCount: number
  variantCount: number
  motive: MotiveUploadResult | null
  skipMotive: boolean
}) {
  if (!detail) return null
  return (
    <div className="border rounded p-4 bg-ui-bg-subtle text-sm space-y-1">
      <div>
        <b>Base:</b> {detail.name} (#{detail.id})
      </div>
      <div>
        <b>Selection:</b> {colorCount} colors × {sizeCount} sizes →{" "}
        <b>{variantCount}</b> variants
      </div>
      <div>
        <b>Motive:</b>{" "}
        {skipMotive ? "None (plain base shirt)" : motive?.filename ?? "—"}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route config — adds a sidebar entry under the admin sidebar
// ---------------------------------------------------------------------------

export const config = defineRouteConfig({
  label: "Create POD product",
  icon: Sparkles,
})

export default NewShirtplatformProductPage
