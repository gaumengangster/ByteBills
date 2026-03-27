import { format } from "date-fns"
import {
  convertAmountToEur,
  mergeEcbLiveRates,
  type EurRatesByDocumentDate,
  type EurReferenceRates,
} from "@/lib/eur-rates"
import { getRevenueDocumentDate } from "@/lib/revenue-document-date"

/** Firestore Timestamp, ISO string, or Date → short list date. */
export function formatDocumentListDate(value: unknown): string {
  if (value == null) {
    return "—"
  }
  try {
    const d =
      value instanceof Date
        ? value
        : typeof value === "object" &&
            value !== null &&
            "toDate" in value &&
            typeof (value as { toDate?: () => Date }).toDate === "function"
          ? (value as { toDate: () => Date }).toDate()
          : new Date(value as string | number)
    if (Number.isNaN(d.getTime())) {
      return "—"
    }
    return format(d, "MMM d, yyyy")
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

/** ECB table: units of `currency` per 1 EUR — list display for one row. */
export function formatListEcbRate(currency: string | undefined, rates: EurReferenceRates): string {
  const c = normalizeListCurrency(currency)
  if (c === "EUR") {
    return "—"
  }
  const u = rates[c]
  if (u == null || !Number.isFinite(u) || u <= 0) {
    return "—"
  }
  return `${u.toFixed(4)} ${c}/EUR`
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

export function listDocumentEurRow(
  doc: { total?: unknown; currency?: string; invoiceDate?: unknown; receiptDate?: unknown },
  kind: "invoice" | "receipt",
  eurRatesByDocDate: EurRatesByDocumentDate | null | undefined,
): { eur: number | null; rateLabel: string } {
  if (eurRatesByDocDate == null) {
    return { eur: null, rateLabel: "…" }
  }
  const d =
    kind === "invoice"
      ? getRevenueDocumentDate({ type: "invoices", invoiceDate: doc.invoiceDate, receiptDate: undefined })
      : getRevenueDocumentDate({ type: "receipts", invoiceDate: undefined, receiptDate: doc.receiptDate })
  if (Number.isNaN(d.getTime())) {
    return { eur: null, rateLabel: "—" }
  }
  const key = format(d, "yyyy-MM-dd")
  const rates = eurRatesByDocDate[key] ?? mergeEcbLiveRates({})
  const total = typeof doc.total === "number" ? doc.total : Number(doc.total)
  const eur = Number.isFinite(total) ? convertAmountToEur(total, doc.currency, rates) : null
  const rateLabel = formatListEcbRate(doc.currency, rates)
  return { eur: eur ?? null, rateLabel }
}
