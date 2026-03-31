/**
 * ECB helpers for document dates (charts/lists that still need a rate row).
 * Report aggregates use persisted `*Eur` fields on invoices, receipts, and bills — no conversion there.
 */

import { format } from "date-fns"
import { mergeEcbLiveRates, type EurRatesByDocumentDate, type EurReferenceRates } from "@/lib/eur-rates"
import { getRevenueDocumentDate } from "@/lib/revenue-document-date"

/** Firestore Timestamp, ISO string, epoch ms, or Date → Date (for `billDate` / `createdAt`). */
export function coerceDocumentDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "object" && "toDate" in (value as object)) {
    const fn = (value as { toDate?: () => Date }).toDate
    if (typeof fn === "function") {
      const d = fn.call(value)
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
    }
  }
  if (typeof value === "string") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const ISO_DAY_PREFIX = /^(\d{4}-\d{2}-\d{2})/

/**
 * `yyyy-MM-dd` for ECB lookup from `billDate` only — no `createdAt` fallback.
 * Date-only strings use the calendar day as-is (avoids UTC/local shifts from `new Date("2025-03-15")`).
 */
export function calendarDateKeyFromCostBill(bill: Record<string, unknown>): string | null {
  // New cost entities use `expenseDate`; legacy bills use `billDate`
  const raw = bill.expenseDate ?? bill.billDate
  if (typeof raw === "string") {
    const m = ISO_DAY_PREFIX.exec(raw.trim())
    if (m) {
      return m[1]
    }
  }
  const fromBillDate = coerceDocumentDate(raw)
  if (fromBillDate) {
    return format(fromBillDate, "yyyy-MM-dd")
  }
  return null
}

/**
 * ECB rates row for an issued invoice or receipt: rate date = invoice / receipt business date.
 */
export function eurRatesForInvoiceOrReceiptDoc(
  doc: { type?: string; invoiceDate?: unknown; receiptDate?: unknown },
  eurRatesByDocDate: EurRatesByDocumentDate | null,
): EurReferenceRates {
  const d = getRevenueDocumentDate(doc)
  if (Number.isNaN(d.getTime())) {
    return mergeEcbLiveRates({})
  }
  const key = format(d, "yyyy-MM-dd")
  return eurRatesByDocDate?.[key] ?? mergeEcbLiveRates({})
}

/**
 * ECB rates row for a supplier cost bill: rate date = `billDate` only.
 */
export function eurRatesForCostBill(
  bill: Record<string, unknown>,
  eurRatesByDocDate: EurRatesByDocumentDate | null,
): EurReferenceRates {
  const key = calendarDateKeyFromCostBill(bill)
  if (!key) {
    return mergeEcbLiveRates({})
  }
  return eurRatesByDocDate?.[key] ?? mergeEcbLiveRates({})
}

/**
 * Whether this bill counts toward input VAT / Vorsteuer helpers.
 * Legacy docs without flags default to included and deductible.
 * New fields: `isPaymentProofOnly` / `includeInVatQuarter` (see `lib/reporting-flags.ts`).
 */
export function billContributesInputVat(bill: Record<string, unknown>): boolean {
  if (bill.isPaymentProofOnly === true) return false
  const inQuarter = bill.includeInVatQuarter ?? bill.includedInVatReturn ?? true
  if (inQuarter === false) return false
  if (bill.includedInVatReturn === false) return false
  if (bill.vatDeductible === false) return false
  return true
}

/** Sum of `vatAmountEur` on cost bills where Vorsteuer applies (saved at upload). */
export function sumBillsVatAmountEur(bills: Record<string, unknown>[]): number {
  let s = 0
  for (const bill of bills) {
    if (!billContributesInputVat(bill)) continue
    const v = bill.vatAmountEur
    if (typeof v === "number" && Number.isFinite(v)) {
      s += v
    }
  }
  return s
}
