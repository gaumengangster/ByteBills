/**
 * EUR amounts for issued invoices and receipts: one rate row per document.
 * Invoices use Leistungsdatum (`taxDate`) only; receipts use receipt date.
 *
 * Rates: Firestore BMF month import only (`buildFxRateRowFromFirestore`).
 */

import type { Firestore } from "firebase/firestore"
import { documentDateKeyBerlin } from "@/lib/document-date-berlin"
import { convertAmountToEur, type EurReferenceRates } from "@/lib/eur-rates"
import { buildFxRateRowFromFirestore } from "@/lib/firestore-fx-rate-row"

export const REVENUE_FX_RATE_MISSING = "REVENUE_FX_RATE_MISSING"

export type RevenueLineItem = {
  description: string
  quantity: number
  unitPrice: number
}

function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

function isYmd(s: string | undefined | null): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
}

/** Berlin calendar yyyy-MM-dd for FX: invoice uses `taxDate` only; receipt uses receipt date. */
export function calendarDateKeyFromRevenueDoc(
  kind: "invoice" | "receipt",
  _invoiceDateIso: string | undefined,
  receiptDateIso: string | undefined,
  invoiceTaxDateIso?: string | null,
): string | null {
  if (kind === "invoice") {
    if (!isYmd(invoiceTaxDateIso)) return null
    return documentDateKeyBerlin(invoiceTaxDateIso.trim())
  }
  return documentDateKeyBerlin(receiptDateIso)
}

export type RevenueDocumentEurPersist = {
  subtotalEur: number
  taxEur: number
  totalEur: number
  eurRateDate: string | null
  /** Units of document currency per 1 EUR; same value used for net, VAT, and gross EUR. Null when currency is EUR. */
  exchangeRateToEur: number | null
  items: Record<string, unknown>[]
}

function unitsPerEurForCurrency(currency: string, rates: EurReferenceRates): number | null {
  const c = (currency.trim() || "EUR").toUpperCase()
  if (c === "EUR") return null
  const u = rates[c]
  if (u == null || !Number.isFinite(u) || u <= 0) return null
  return u
}

export async function resolveReferenceRatesForRevenueDocument(params: {
  db: Firestore
  userId: string
  kind: "invoice" | "receipt"
  invoiceDateIso?: string
  invoiceTaxDateIso?: string | null
  receiptDateIso?: string
  currency: string
}): Promise<{ rates: EurReferenceRates; monthKey: string | null }> {
  const dateKey = calendarDateKeyFromRevenueDoc(
    params.kind,
    params.kind === "invoice" ? params.invoiceDateIso : undefined,
    params.kind === "receipt" ? params.receiptDateIso : undefined,
    params.kind === "invoice" ? params.invoiceTaxDateIso : undefined,
  )
  const monthKey = dateKey && dateKey.length >= 7 ? dateKey.slice(0, 7) : null
  const cur = (params.currency.trim() || "EUR").toUpperCase()

  const rates = await buildFxRateRowFromFirestore({
    db: params.db,
    userId: params.userId,
    monthKey,
  })

  if (cur === "EUR") {
    return { rates, monthKey }
  }

  const u = rates[cur]
  if (typeof u !== "number" || !Number.isFinite(u) || u <= 0) {
    throw new Error(REVENUE_FX_RATE_MISSING)
  }

  return { rates, monthKey }
}

/**
 * Computes persisted EUR fields using Firestore BMF import for the document month.
 */
export async function buildRevenueDocumentEurPersist(params: {
  db: Firestore
  userId: string
  kind: "invoice" | "receipt"
  invoiceDateIso?: string
  invoiceTaxDateIso?: string | null
  receiptDateIso?: string
  currency: string
  subtotal: number
  tax: number
  total: number
  items: RevenueLineItem[]
}): Promise<RevenueDocumentEurPersist> {
  const dateKey = calendarDateKeyFromRevenueDoc(
    params.kind,
    params.kind === "invoice" ? params.invoiceDateIso : undefined,
    params.kind === "receipt" ? params.receiptDateIso : undefined,
    params.kind === "invoice" ? params.invoiceTaxDateIso : undefined,
  )

  const { rates } = await resolveReferenceRatesForRevenueDocument({
    db: params.db,
    userId: params.userId,
    kind: params.kind,
    invoiceDateIso: params.invoiceDateIso,
    invoiceTaxDateIso: params.invoiceTaxDateIso,
    receiptDateIso: params.receiptDateIso,
    currency: params.currency,
  })

  const cur = (params.currency.trim() || "EUR").toUpperCase()

  const toEur = (amount: number) => roundMoneyEur(convertAmountToEur(amount, cur, rates))

  const items: Record<string, unknown>[] = params.items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitPriceEur: toEur(item.unitPrice),
      lineTotalEur: toEur(lineTotal),
    }
  })

  return {
    subtotalEur: toEur(params.subtotal),
    taxEur: toEur(params.tax),
    totalEur: toEur(params.total),
    eurRateDate: dateKey,
    exchangeRateToEur: unitsPerEurForCurrency(cur, rates),
    items,
  }
}

function eurField(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

/** Reporting: persisted EUR only (`subtotalEur` on invoices). */
export function invoiceSubtotalEurFromDoc(doc: Record<string, unknown>): number {
  return eurField(doc.subtotalEur)
}

/**
 * Net turnover in EUR for EÜR-style income (matches `subtotalEur` when set).
 * If `subtotalEur` is missing (legacy docs), uses `totalEur - taxEur` when both exist.
 */
export function invoiceNetIncomeEurFromDoc(doc: Record<string, unknown>): number {
  const raw = doc.subtotalEur
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }
  const total = eurField(doc.totalEur)
  const tax = eurField(doc.taxEur)
  if (total > 0 && tax >= 0 && total + 1e-9 >= tax) {
    return roundMoneyEur(total - tax)
  }
  return 0
}

/** Reporting: persisted EUR only (`taxEur` on invoices). */
export function invoiceTaxEurFromDoc(doc: Record<string, unknown>): number {
  return eurField(doc.taxEur)
}

/** Reporting: persisted EUR only (`totalEur` on invoices/receipts). */
export function revenueTotalEurFromDoc(doc: Record<string, unknown>): number {
  return eurField(doc.totalEur)
}

/** Prefer `reportTaxEur` when the reports page enriched the doc with BMF monthly rates. */
export function invoiceTaxEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportTaxEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  return invoiceTaxEurFromDoc(doc)
}

export function invoiceNetIncomeEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportSubtotalEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  return invoiceNetIncomeEurFromDoc(doc)
}

export function invoiceTotalEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportTotalEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  return revenueTotalEurFromDoc(doc)
}

export function receiptTaxEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportTaxEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  return invoiceTaxEurFromDoc(doc)
}

export function receiptSubtotalEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportSubtotalEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  const s = doc.subtotalEur
  return typeof s === "number" && Number.isFinite(s) ? s : 0
}

export function receiptTotalEurForReport(doc: Record<string, unknown>): number {
  const r = doc.reportTotalEur
  if (typeof r === "number" && Number.isFinite(r)) return r
  return revenueTotalEurFromDoc(doc)
}
