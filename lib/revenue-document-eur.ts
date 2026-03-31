/**
 * ECB conversion for issued invoices and receipts: rate date = invoice date / receipt date
 * (same as `eurRatesForInvoiceOrReceiptDoc` / list EUR column).
 */

import { startOfDay } from "date-fns"
import { documentDateKeyBerlin } from "@/lib/document-date-berlin"
import { convertAmountToEur, fetchEurRatesForDocumentDates } from "@/lib/eur-rates"
import { eurRatesForInvoiceOrReceiptDoc } from "@/lib/report-eur-rates"

export type RevenueLineItem = {
  description: string
  quantity: number
  unitPrice: number
}

/**
 * ECB rates exist only for past and current calendar days. Non-EUR documents need a rate when saving EUR amounts.
 */
export function isNonEurWithFutureBusinessDate(currency: string, businessDate: Date): boolean {
  const c = currency.trim().toUpperCase()
  if (c === "EUR") return false
  return startOfDay(businessDate).getTime() > startOfDay(new Date()).getTime()
}

function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

export function calendarDateKeyFromRevenueDoc(
  kind: "invoice" | "receipt",
  invoiceDateIso: string | undefined,
  receiptDateIso: string | undefined,
): string | null {
  const raw = kind === "invoice" ? invoiceDateIso : receiptDateIso
  return documentDateKeyBerlin(raw)
}

export type RevenueDocumentEurPersist = {
  subtotalEur: number
  taxEur: number
  totalEur: number
  eurRateDate: string | null
  items: Record<string, unknown>[]
}

/**
 * Fetches ECB row for the document date and returns EUR totals + line-level EUR (unit price & line total).
 */
export async function buildRevenueDocumentEurPersist(params: {
  kind: "invoice" | "receipt"
  invoiceDateIso?: string
  receiptDateIso?: string
  currency: string
  subtotal: number
  tax: number
  total: number
  items: RevenueLineItem[]
}): Promise<RevenueDocumentEurPersist> {
  const dateKey = calendarDateKeyFromRevenueDoc(
    params.kind,
    params.invoiceDateIso,
    params.receiptDateIso,
  )
  const eurRatesByDocDate = await fetchEurRatesForDocumentDates(dateKey ? [dateKey] : [])

  const stub: Record<string, unknown> =
    params.kind === "invoice"
      ? { type: "invoices", invoiceDate: params.invoiceDateIso, receiptDate: undefined }
      : { type: "receipts", invoiceDate: undefined, receiptDate: params.receiptDateIso }

  const rates = eurRatesForInvoiceOrReceiptDoc(
    stub as { type?: string; invoiceDate?: unknown; receiptDate?: unknown },
    eurRatesByDocDate,
  )
  const cur = params.currency.trim() || "EUR"

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
