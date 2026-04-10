import countryList from "react-select-country-list"

const countries = countryList().getData()

/** Full English country name for a 2-letter ISO code (e.g. DE → Germany). */
export function countryIso2ToLabel(code: string | undefined | null): string {
  if (!code?.trim()) return ""
  const upper = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return code.trim()
  return countries.find((c) => c.value === upper)?.label ?? code.trim()
}

/**
 * Value for the country `<Select>`: ISO code from stored full name, or pass-through if already a known code (legacy).
 */
export function countryStoredToSelectCode(stored: string | undefined | null): string {
  if (!stored?.trim()) return ""
  const t = stored.trim()
  if (/^[A-Za-z]{2}$/.test(t)) {
    const upper = t.toUpperCase()
    if (countries.some((c) => c.value === upper)) return upper
  }
  return countries.find((c) => c.label === t)?.value ?? ""
}

/** Normalize Firestore value: legacy 2-letter codes become full labels. */
export function normalizeStoredCountryForForm(stored: string | undefined | null): string {
  if (!stored?.trim()) return defaultUsCountryLabel()
  const t = stored.trim()
  if (/^[A-Za-z]{2}$/.test(t) && countries.some((c) => c.value === t.toUpperCase())) {
    return countryIso2ToLabel(t)
  }
  return t
}

export function defaultUsCountryLabel(): string {
  return countries.find((c) => c.value === "US")?.label ?? "United States"
}

export function getCountryOptions(): { label: string; value: string }[] {
  return countries
}
