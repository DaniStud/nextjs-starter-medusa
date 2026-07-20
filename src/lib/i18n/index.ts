import translations from "./translations.json"

const DEFAULT_LOCALE = "da"

type Translations = typeof translations
type Locale = keyof Translations

// Build-time brand overrides via NEXT_PUBLIC env vars
const brandOverrides: Record<string, string> = {
  ...(process.env.NEXT_PUBLIC_BRAND_NAME && {
    "nav.brand": process.env.NEXT_PUBLIC_BRAND_NAME,
  }),
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = translations[DEFAULT_LOCALE as Locale] as Record<string, string>
  const fallback = translations.en as Record<string, string>
  let text = brandOverrides[key] || dict[key] || fallback[key] || key

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{{${k}}}`, String(v))
    }
  }

  return text
}
