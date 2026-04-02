/**
 * Load merged BMF monthly rates from `exchange_rates/{userId}_bmf_{year}` for report-time EUR conversion.
 */
import { doc, getDoc, type Firestore } from "firebase/firestore"
import {
  BMF_UST_CSV_YEAR_KIND,
  bmfUstCsvYearDocId,
  EXCHANGE_RATES_COLLECTION,
} from "@/lib/exchange-rates-store"
import { documentDateKeyBerlin } from "@/lib/document-date-berlin"
import { calendarDateKeyFromRevenueDoc } from "@/lib/revenue-document-eur"
import {
  invoiceNetIncomeEurFromDoc,
  invoiceTaxEurFromDoc,
  revenueTotalEurFromDoc,
} from "@/lib/revenue-document-eur"

export async function fetchMergedBmfRatesByMonth(
  db: Firestore,
  userId: string,
  years: Iterable<number>,
): Promise<Record<string, Record<string, number>>> {
  const merged: Record<string, Record<string, number>> = {}
  const sortedYears = [...new Set(years)].filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100).sort()
  for (const year of sortedYears) {
    const snap = await getDoc(doc(db, EXCHANGE_RATES_COLLECTION, bmfUstCsvYearDocId(userId, year)))
    if (!snap.exists()) continue
    const data = snap.data()
    if (data.kind !== BMF_UST_CSV_YEAR_KIND) continue
    const rb = data.ratesByMonth
    if (rb == null || typeof rb !== "object" || Array.isArray(rb)) continue
    for (const [mk, row] of Object.entries(rb as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}$/.test(mk)) continue
      if (row == null || typeof row !== "object" || Array.isArray(row)) continue
      const out: Record<string, number> = { ...merged[mk] }
      for (const [code, v] of Object.entries(row as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          out[String(code).toUpperCase()] = v
        }
      }
      merged[mk] = out
    }
  }
  return merged
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number.parseFloat(String(v).trim().replace(/\s/g, "").replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

function unitsPerEur(
  bmfByMonth: Record<string, Record<string, number>>,
  monthKey: string,
  currency: string,
): number | null {
  const cur = (currency || "EUR").toUpperCase()
  if (cur === "EUR") return null
  const row = bmfByMonth[monthKey]
  if (!row) return null
  const u = row[cur]
  if (typeof u !== "number" || !Number.isFinite(u) || u <= 0) return null
  return u
}

/** `yyyy-MM` for BMF column from invoice `taxDate` (Leistungsdatum) only. */
export function bmfMonthKeyFromInvoiceDoc(doc: Record<string, unknown>): string | null {
  const ymd = calendarDateKeyFromRevenueDoc("invoice", undefined, undefined, doc.taxDate as string | null | undefined)
  return ymd && ymd.length >= 7 ? ymd.slice(0, 7) : null
}

/** `yyyy-MM` from receipt date (string ymd or Firestore Timestamp). */
export function bmfMonthKeyFromReceiptDoc(doc: Record<string, unknown>): string | null {
  const ymd = documentDateKeyBerlin(doc.receiptDate)
  return ymd && ymd.length >= 7 ? ymd.slice(0, 7) : null
}

export type BmfOrPersistedEurTriple = {
  subtotalEur: number
  taxEur: number
  totalEur: number
  source: "bmf" | "persisted"
}

function toEurAmount(amount: number, currency: string, u: number | null): number | null {
  const v = num(amount)
  const cur = (currency || "EUR").toUpperCase()
  if (cur === "EUR") return roundMoneyEur(v)
  if (u == null) return null
  return roundMoneyEur(v / u)
}

export function invoiceEurTripleFromBmfOrPersisted(
  doc: Record<string, unknown>,
  bmfByMonth: Record<string, Record<string, number>> | null | undefined,
): BmfOrPersistedEurTriple {
  const bmf = bmfByMonth && Object.keys(bmfByMonth).length > 0 ? bmfByMonth : null
  const monthKey = bmfMonthKeyFromInvoiceDoc(doc)
  const cur = String(doc.currency ?? "EUR").toUpperCase()
  const sub = num(doc.subtotal)
  const tax = num(doc.tax)
  const total = num(doc.total)

  if (bmf && monthKey) {
    const u = unitsPerEur(bmf, monthKey, cur)
    if (cur === "EUR") {
      return {
        subtotalEur: roundMoneyEur(sub),
        taxEur: roundMoneyEur(tax),
        totalEur: roundMoneyEur(total),
        source: "bmf",
      }
    }
    if (u != null) {
      const se = toEurAmount(sub, cur, u)
      const te = toEurAmount(tax, cur, u)
      const tot = toEurAmount(total, cur, u)
      if (se != null && te != null && tot != null) {
        return { subtotalEur: se, taxEur: te, totalEur: tot, source: "bmf" }
      }
    }
  }

  return {
    subtotalEur: invoiceNetIncomeEurFromDoc(doc),
    taxEur: invoiceTaxEurFromDoc(doc),
    totalEur: revenueTotalEurFromDoc(doc),
    source: "persisted",
  }
}

export function receiptEurTripleFromBmfOrPersisted(
  doc: Record<string, unknown>,
  bmfByMonth: Record<string, Record<string, number>> | null | undefined,
): BmfOrPersistedEurTriple {
  const bmf = bmfByMonth && Object.keys(bmfByMonth).length > 0 ? bmfByMonth : null
  const monthKey = bmfMonthKeyFromReceiptDoc(doc)
  const cur = String(doc.currency ?? "EUR").toUpperCase()
  const sub = num(doc.subtotal)
  const tax = num(doc.tax)
  const total = num(doc.total)

  if (bmf && monthKey) {
    const u = unitsPerEur(bmf, monthKey, cur)
    if (cur === "EUR") {
      return {
        subtotalEur: roundMoneyEur(sub),
        taxEur: roundMoneyEur(tax),
        totalEur: roundMoneyEur(total),
        source: "bmf",
      }
    }
    if (u != null) {
      const se = toEurAmount(sub, cur, u)
      const te = toEurAmount(tax, cur, u)
      const tot = toEurAmount(total, cur, u)
      if (se != null && te != null && tot != null) {
        return { subtotalEur: se, taxEur: te, totalEur: tot, source: "bmf" }
      }
    }
  }

  const subE = typeof doc.subtotalEur === "number" && Number.isFinite(doc.subtotalEur) ? doc.subtotalEur : 0
  const taxE = invoiceTaxEurFromDoc(doc)
  const totE = revenueTotalEurFromDoc(doc)
  return {
    subtotalEur: subE,
    taxEur: taxE,
    totalEur: totE,
    source: "persisted",
  }
}

export function collectBmfYearsFromInvoiceDoc(doc: Record<string, unknown>): number | null {
  const mk = bmfMonthKeyFromInvoiceDoc(doc)
  if (!mk) return null
  const y = parseInt(mk.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

export function collectBmfYearsFromReceiptDoc(doc: Record<string, unknown>): number | null {
  const mk = bmfMonthKeyFromReceiptDoc(doc)
  if (!mk) return null
  const y = parseInt(mk.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

/** Attach `reportSubtotalEur`, `reportTaxEur`, `reportTotalEur`, `reportEurSource` for invoices/receipts. */
export function enrichRevenueDocsWithBmfReportEur<T extends Record<string, unknown> & { type?: string }>(
  docs: T[],
  bmfByMonth: Record<string, Record<string, number>> | null,
): T[] {
  if (!bmfByMonth || Object.keys(bmfByMonth).length === 0) return docs
  return docs.map((doc) => {
    if (doc.type === "invoices") {
      const t = invoiceEurTripleFromBmfOrPersisted(doc, bmfByMonth)
      return {
        ...doc,
        reportSubtotalEur: t.subtotalEur,
        reportTaxEur: t.taxEur,
        reportTotalEur: t.totalEur,
        reportEurSource: t.source,
      }
    }
    if (doc.type === "receipts") {
      const t = receiptEurTripleFromBmfOrPersisted(doc, bmfByMonth)
      return {
        ...doc,
        reportSubtotalEur: t.subtotalEur,
        reportTaxEur: t.taxEur,
        reportTotalEur: t.totalEur,
        reportEurSource: t.source,
      }
    }
    return doc
  })
}
