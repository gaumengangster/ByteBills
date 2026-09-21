import { costNetEurForContext, costVatEurForContext } from "@/lib/cost-report-aggregation"
import { assetDepreciationForCalendarMonthEur } from "@/lib/eur-euer-yearly"
import {
  emptyBwa43Leaves,
  finalizeBwa43,
  roundBwaEur,
  type Bwa43Amounts,
  type Bwa43LeafId,
} from "@/lib/bwa-43-model"
import { isCompulsoryTkHealthCare, isPrivateTaxPrepayment, costCategoryOf } from "@/lib/euer-expense-category"
import { persistedBillNetEur } from "@/lib/report-eur-rates"
import { isCancelledRevenueInvoice, revenueInvoiceReportingYmd } from "@/lib/reporting-flags"
import { invoiceNetIncomeEurForReport, invoiceTaxEurForReport } from "@/lib/revenue-document-eur"

export type YmdRange = { from: string; to: string }

function ymdInRange(ymd: string | null, range: YmdRange): boolean {
  if (!ymd || ymd.length < 10) return false
  const k = ymd.slice(0, 10)
  return k >= range.from && k <= range.to
}

function invoiceStatus(doc: Record<string, unknown>): string {
  return String(doc.status ?? "").trim().toLowerCase()
}

function isPaidInvoice(doc: Record<string, unknown>): boolean {
  return invoiceStatus(doc) === "paid"
}

function costExpenseYmd(doc: Record<string, unknown>): string | null {
  const d = doc.expenseDate
  if (typeof d === "string" && d.length >= 10) return d.slice(0, 10)
  return null
}

function pauschalBounds(doc: Record<string, unknown>): { from: string; to: string } | null {
  const from =
    typeof doc.fromDate === "string"
      ? doc.fromDate
      : typeof doc.periodFrom === "string"
        ? doc.periodFrom
        : ""
  const to =
    typeof doc.toDate === "string" ? doc.toDate : typeof doc.periodTo === "string" ? doc.periodTo : ""
  if (!from || !to) return null
  return { from: from.slice(0, 10), to: to.slice(0, 10) }
}

function pauschalAmount(doc: Record<string, unknown>): number {
  const a = doc.amountEur ?? doc.calculatedAmount ?? doc.amountNet
  return typeof a === "number" && Number.isFinite(a) ? a : 0
}

type YearMonth = { year: number; month: number }

function ymKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`
}

function monthsInYmdRange(range: YmdRange): YearMonth[] {
  const out: YearMonth[] = []
  let y = Number(range.from.slice(0, 4))
  let m = Number(range.from.slice(5, 7))
  const endY = Number(range.to.slice(0, 4))
  const endM = Number(range.to.slice(5, 7))
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

function splitAcrossYearMonths(amount: number, months: YearMonth[]): Map<string, number> {
  const out = new Map<string, number>()
  if (months.length === 0 || amount === 0) return out
  const n = months.length
  const monthly = Math.round((amount / n) * 100) / 100
  let allocated = 0
  months.forEach((ym, i) => {
    const v = i === n - 1 ? roundBwaEur(amount - allocated) : monthly
    out.set(ymKey(ym), v)
    allocated = roundBwaEur(allocated + v)
  })
  return out
}

export function bwaCostLineFromCategory(cat: string | undefined | null): Bwa43LeafId {
  switch (cat) {
    case "homeoffice_miete":
    case "homeoffice":
      return "raumkosten"
    case "insurance":
      return "steuern_versicherung"
    case "travel":
      return "werbe_reisekosten"
    case "hardware":
    case "furniture":
      return "edv_buero_gwg"
    case "pendler":
      return "fahrzeugkosten"
    default:
      return "verschiedene_kosten"
  }
}

function addLeaf(leaves: Record<Bwa43LeafId, number>, id: Bwa43LeafId, n: number) {
  if (!Number.isFinite(n) || n === 0) return
  leaves[id] = roundBwaEur(leaves[id] + n)
}

export function aggregateBwa43ForRange(params: {
  range: YmdRange
  invoices: Array<Record<string, unknown>>
  euerCosts: Array<Record<string, unknown>>
  vatCosts: Array<Record<string, unknown>>
  pauschalDocs: Array<Record<string, unknown>>
  assetDocs: Array<Record<string, unknown>>
}): Bwa43Amounts {
  const { range, invoices, euerCosts, vatCosts, pauschalDocs, assetDocs } = params
  const leaves = emptyBwa43Leaves()
  const months = monthsInYmdRange(range)

  for (const doc of invoices) {
    if (doc.type && doc.type !== "invoices") continue
    if (isCancelledRevenueInvoice(doc)) continue
    const ymd = revenueInvoiceReportingYmd(doc)
    if (!ymdInRange(ymd, range)) continue
    const net = invoiceNetIncomeEurForReport(doc)
    const tax = invoiceTaxEurForReport(doc)
    addLeaf(leaves, "erloese_betrieblich", net)
    addLeaf(leaves, "umsatzsteuer", tax)
    if (!isPaidInvoice(doc)) addLeaf(leaves, "zugang_forderungen", net)
  }

  for (const bill of euerCosts) {
    const ymd = costExpenseYmd(bill)
    if (!ymdInRange(ymd, range)) continue
    if (bill.type === "cost_afa") {
      const purchase = costNetEurForContext(bill, "dashboard")
      if (purchase != null) addLeaf(leaves, "anlagenzugaenge", purchase)
      continue
    }
    const cat = costCategoryOf(bill)
    if (isCompulsoryTkHealthCare(cat)) continue
    if (isPrivateTaxPrepayment(cat)) {
      const net = persistedBillNetEur(bill)
      if (net != null) addLeaf(leaves, "privatsteuern", net)
      continue
    }
    const operating = costNetEurForContext(bill, "euerNet")
    if (operating == null) continue
    addLeaf(leaves, bwaCostLineFromCategory(cat || null), operating)
  }

  for (const bill of vatCosts) {
    const ymd = costExpenseYmd(bill)
    if (!ymdInRange(ymd, range)) continue
    const vat = costVatEurForContext(bill, "vatQuarter")
    if (vat == null) continue
    addLeaf(leaves, "vorsteuer", vat)
  }

  for (const p of pauschalDocs) {
    const b = pauschalBounds(p)
    if (!b) continue
    const amt = pauschalAmount(p)
    if (amt === 0) continue
    const shares = splitAcrossYearMonths(amt, monthsInYmdRange(b))
    const cat = String(p.category ?? p.pauschaleType ?? "")
    const line = cat === "pendler" || cat === "mileage" ? "fahrzeugkosten" : bwaCostLineFromCategory(cat)
    let sum = 0
    for (const ym of months) sum += shares.get(ymKey(ym)) ?? 0
    addLeaf(leaves, line, sum)
  }

  for (const a of assetDocs) {
    let afa = 0
    for (const ym of months) afa += assetDepreciationForCalendarMonthEur(a, ym.year, ym.month)
    addLeaf(leaves, "abschreibungen", afa)
  }

  leaves.afa_nicht_kalkulatorisch = leaves.abschreibungen
  return finalizeBwa43(leaves)
}
