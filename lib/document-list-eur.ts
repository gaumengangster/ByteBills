import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"

/** Firestore Timestamp, ISO string, yyyy-MM-dd, or Date → short list date (Europe/Berlin). */
export function formatDocumentListDate(value: unknown): string {
  if (value == null) {
    return "—"
  }
  try {
    const s = formatDocumentDateBerlin(value, "MMM d, yyyy")
    return s === "—" ? "—" : s
  } catch {
    return "—"
  }
}

export function normalizeListCurrency(currency: string | undefined): string {
  if (typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency.trim())) {
    return currency.trim().toUpperCase()
  }
  return "EUR"
}

export function formatListEurAmount(amount: number | null): string {
  if (amount === null) {
    return "…"
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * EUR column from persisted `totalEur` on invoices/receipts (saved at document creation).
 * FX column shows `exchangeRateToEur` (units of doc currency per 1 EUR) when set.
 */
export function listDocumentEurRow(
  doc: { totalEur?: unknown; currency?: unknown; exchangeRateToEur?: unknown },
  _kind: "invoice" | "receipt",
): { eur: number | null; rateLabel: string } {
  const v = doc.totalEur
  const eur = typeof v === "number" && Number.isFinite(v) ? v : null
  const cur = normalizeListCurrency(typeof doc.currency === "string" ? doc.currency : undefined)
  const ex = doc.exchangeRateToEur
  const rate = typeof ex === "number" && Number.isFinite(ex) && ex > 0 ? ex : null
  if (cur !== "EUR" && rate != null) {
    return { eur, rateLabel: `1 EUR = ${rate.toFixed(4)} ${cur}` }
  }
  return { eur, rateLabel: "—" }
}
