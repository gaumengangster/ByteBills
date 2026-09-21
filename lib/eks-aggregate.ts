import { costNetEurForContext, costVatEurForContext } from "@/lib/cost-report-aggregation"
import { eksBLineFromCategory, eksBLineFromPauschaleType } from "@/lib/eks-category-map"
import {
  emptyEksCAmounts,
  emptyEksLeaves,
  eksMonthRange,
  eksSixMonthsEnding,
  eksYmKey,
  finalizeEks,
  roundEksEur,
  type EksAmounts,
  type EksCAmounts,
  type EksLeafId,
  type EksYearMonth,
} from "@/lib/eks-model"
import { costCategoryOf, isCompulsoryTkHealthCare, isPersonalIncomeDeduction, isPrivateTaxPrepayment } from "@/lib/euer-expense-category"
import { paymentDateYmd } from "@/lib/payment-date"
import { persistedBillNetEur } from "@/lib/report-eur-rates"
import { isCancelledRevenueInvoice } from "@/lib/reporting-flags"
import { invoiceNetIncomeEurForReport, invoiceTaxEurForReport } from "@/lib/revenue-document-eur"

export type EksDocs = {
  invoices: Array<Record<string, unknown>>
  costs: Array<Record<string, unknown>>
  pauschalDocs: Array<Record<string, unknown>>
}

function ymdInRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd || ymd.length < 10) return false
  const k = ymd.slice(0, 10)
  return k >= from && k <= to
}

function costCashYmd(doc: Record<string, unknown>): string | null {
  const paid = paymentDateYmd(doc.paymentDate)
  if (paid) return paid
  if (String(doc.type ?? "") === "cost_afa") {
    const pd = doc.purchaseDate
    if (typeof pd === "string" && pd.length >= 10) return pd.slice(0, 10)
  }
  return null
}

function addLeaf(leaves: Record<EksLeafId, number>, id: EksLeafId, n: number) {
  if (!Number.isFinite(n) || n === 0) return
  leaves[id] = roundEksEur(leaves[id] + n)
}

type Ym = { year: number; month: number }

function monthsInYmdRange(from: string, to: string): Ym[] {
  const out: Ym[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const endY = Number(to.slice(0, 4))
  const endM = Number(to.slice(5, 7))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(endY) || !Number.isFinite(endM)) return out
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function splitAcrossMonths(amount: number, months: Ym[]): Map<string, number> {
  const out = new Map<string, number>()
  if (months.length === 0 || amount === 0) return out
  const monthly = Math.round((amount / months.length) * 100) / 100
  let allocated = 0
  months.forEach((ym, i) => {
    const v = i === months.length - 1 ? roundEksEur(amount - allocated) : monthly
    out.set(eksYmKey(ym), v)
    allocated = roundEksEur(allocated + v)
  })
  return out
}

function pauschalBounds(doc: Record<string, unknown>): { from: string; to: string } | null {
  const from =
    typeof doc.periodFrom === "string"
      ? doc.periodFrom
      : typeof doc.fromDate === "string"
        ? doc.fromDate
        : ""
  const to =
    typeof doc.periodTo === "string" ? doc.periodTo : typeof doc.toDate === "string" ? doc.toDate : ""
  if (!from || !to) return null
  return { from: from.slice(0, 10), to: to.slice(0, 10) }
}

function pauschalAmount(doc: Record<string, unknown>): number {
  const a = doc.calculatedAmount ?? doc.amountEur ?? doc.amountNet
  return typeof a === "number" && Number.isFinite(a) ? a : 0
}

export function aggregateEksForMonth(docs: EksDocs, ym: EksYearMonth): EksAmounts {
  const range = eksMonthRange(ym.year, ym.month)
  const leaves = emptyEksLeaves()

  for (const inv of docs.invoices) {
    if (isCancelledRevenueInvoice(inv)) continue
    const paid = paymentDateYmd(inv.paymentDate)
    if (!ymdInRange(paid, range.from, range.to)) continue
    addLeaf(leaves, "a1", invoiceNetIncomeEurForReport(inv))
    addLeaf(leaves, "a5_1", invoiceTaxEurForReport(inv))
  }

  for (const cost of docs.costs) {
    const cat = costCategoryOf(cost)
    if (isPersonalIncomeDeduction(cat)) continue
    const paid = costCashYmd(cost)
    if (!ymdInRange(paid, range.from, range.to)) continue

    if (String(cost.type ?? "") === "cost_afa") {
      const net = persistedBillNetEur(cost)
      if (net != null) addLeaf(leaves, "b8", net)
      const vat = costVatEurForContext(cost, "vatQuarter")
      if (vat != null) addLeaf(leaves, "b17", vat)
      continue
    }

    const line = eksBLineFromCategory(cat)
    if (line) {
      const net = costNetEurForContext(cost, "euerNet")
      if (net != null) addLeaf(leaves, line, net)
    }
    const vat = costVatEurForContext(cost, "vatQuarter")
    if (vat != null) addLeaf(leaves, "b17", vat)
  }

  const ymKey = eksYmKey(ym)
  for (const p of docs.pauschalDocs) {
    const b = pauschalBounds(p)
    if (!b) continue
    const amt = pauschalAmount(p)
    if (amt === 0) continue
    const shares = splitAcrossMonths(amt, monthsInYmdRange(b.from, b.to))
    const share = shares.get(ymKey) ?? 0
    if (share === 0) continue
    const rawType = typeof p.pauschaleType === "string" ? p.pauschaleType : null
    const line =
      eksBLineFromPauschaleType(rawType) ??
      eksBLineFromCategory(typeof p.category === "string" ? p.category : null) ??
      "b14_5"
    addLeaf(leaves, line, share)
  }

  return finalizeEks(leaves)
}

export function aggregateEksCForWindow(docs: EksDocs, from: string, to: string): EksCAmounts {
  const c = emptyEksCAmounts()
  let taxCount = 0
  let tkCount = 0
  for (const cost of docs.costs) {
    const cat = costCategoryOf(cost)
    const paid = costCashYmd(cost)
    if (!ymdInRange(paid, from, to)) continue
    const net = persistedBillNetEur(cost)
    if (net == null) continue
    if (isPrivateTaxPrepayment(cat)) {
      c.c_est.amount = roundEksEur(c.c_est.amount + net)
      taxCount += 1
    } else if (isCompulsoryTkHealthCare(cat)) {
      c.c_pflicht_kv.amount = roundEksEur(c.c_pflicht_kv.amount + net)
      tkCount += 1
    }
  }
  if (c.c_est.amount > 0) {
    c.c_est.rhythm = taxCount >= 2 ? "monatlich" : "zu bestimmten Terminen"
  }
  if (c.c_pflicht_kv.amount > 0) {
    c.c_pflicht_kv.rhythm = tkCount >= 2 ? "monatlich" : "zu bestimmten Terminen"
  }
  return c
}

export type EksMonthGrid = {
  months: EksYearMonth[]
  byMonth: Record<string, EksAmounts>
  summe: EksAmounts
  tableC: EksCAmounts
  window: { from: string; to: string }
}

export function aggregateEksForSixMonths(docs: EksDocs, endYear: number, endMonth: number): EksMonthGrid {
  const months = eksSixMonthsEnding(endYear, endMonth)
  const byMonth: Record<string, EksAmounts> = {}
  const sumLeaves = emptyEksLeaves()
  for (const ym of months) {
    const amounts = aggregateEksForMonth(docs, ym)
    byMonth[eksYmKey(ym)] = amounts
    for (const k of Object.keys(sumLeaves) as EksLeafId[]) {
      sumLeaves[k] = roundEksEur(sumLeaves[k] + amounts[k])
    }
  }
  const first = eksMonthRange(months[0]!.year, months[0]!.month)
  const last = eksMonthRange(months[months.length - 1]!.year, months[months.length - 1]!.month)
  return {
    months,
    byMonth,
    summe: finalizeEks(sumLeaves),
    tableC: aggregateEksCForWindow(docs, first.from, last.to),
    window: { from: first.from, to: last.to },
  }
}
