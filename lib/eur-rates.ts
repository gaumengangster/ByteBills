/**
 * EUR conversion helpers and types. FX values come only from Firestore BMF import — see `buildFxRateRowFromFirestore`.
 */

export type EurReferenceRates = Record<string, number>

/**
 * Stable landing page for official USt conversion rates (BMF open data).
 */
export const DEFAULT_OFFICIAL_EXCHANGE_RATE_DOCUMENT_URL =
  "https://www.bundesfinanzministerium.de/Datenportal/Daten/offene-daten/steuern-zoelle/umsatzsteuer-umrechnungskurse/umsatzsteuer-umrechnungskurse.html"

/** Overlay wins for each currency code; EUR is always 1. */
export function mergeFxRateRows(base: EurReferenceRates, overlay: Record<string, number>): EurReferenceRates {
  return { ...base, ...overlay, EUR: 1 }
}

function normalizeCurrency(c: string | undefined): string {
  if (typeof c === "string" && /^[A-Za-z]{3}$/.test(c.trim())) {
    return c.trim().toUpperCase()
  }
  return "EUR"
}

export function convertAmountToEur(
  amount: number,
  currency: string | undefined,
  rates: EurReferenceRates,
): number {
  const v = Number(amount)
  if (!Number.isFinite(v)) {
    return 0
  }
  const c = normalizeCurrency(currency)
  if (c === "EUR") {
    return v
  }
  const unitsPerEur = rates[c]
  if (unitsPerEur == null || !Number.isFinite(unitsPerEur) || unitsPerEur <= 0) {
    return v
  }
  return v / unitsPerEur
}
