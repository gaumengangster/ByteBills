import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { aggregateBwa43ForRange } from "@/lib/bwa-43-aggregate"
import {
  bwa43Last6MonthsRange,
  bwa43MonthRange,
  yearsTouchingRange,
  type Bwa43Amounts,
} from "@/lib/bwa-43-model"
import {
  collectBmfYearsFromInvoiceDoc,
  enrichRevenueDocsWithBmfReportEur,
  fetchMergedBmfRatesByMonth,
} from "@/lib/bmf-rates-report"
import { mergeCostDocsById } from "@/lib/cost-report-aggregation"
import { aggregateEurAnnualSummary, type EurAnnualSummary } from "@/lib/eur-annual-summary"
import { fetchAssetsForUser, fetchPauschalCostsForUser } from "@/lib/fetch-pauschal-assets"
import { fetchBillsForEuerYear, fetchBillsForVatPeriod } from "@/lib/report-fetch-bills"
import {
  invoiceDateYmdBoundsForVatReportingYear,
  isCancelledRevenueInvoice,
  revenueInvoiceReportingYmd,
} from "@/lib/reporting-flags"

export type BwaCompanyHeader = {
  name: string
  email: string
}

export type BwaEuerYearPayload = {
  year: number
  month: number
  invoices: Array<Record<string, unknown> & { type?: string }>
  euerCosts: Array<Record<string, unknown>>
  vatCosts: Array<Record<string, unknown>>
  pauschalDocs: Array<Record<string, unknown>>
  assetDocs: Array<Record<string, unknown>>
  euer: EurAnnualSummary
  company: BwaCompanyHeader
}

export async function loadBwaEuerPeriod(userId: string, year: number, month: number): Promise<BwaEuerYearPayload> {
  const last6 = bwa43Last6MonthsRange(year, month)
  const keepFrom = last6.from < `${year}-01-01` ? last6.from : `${year}-01-01`
  const keepTo = last6.to > `${year}-12-31` ? last6.to : `${year}-12-31`
  const years = yearsTouchingRange({ from: keepFrom, to: keepTo })
  const invFrom = invoiceDateYmdBoundsForVatReportingYear(years[0] ?? year).from
  const invTo = invoiceDateYmdBoundsForVatReportingYear(years[years.length - 1] ?? year).to

  const invQ = query(
    collection(db, "invoices"),
    where("userId", "==", userId),
    where("invoiceDate", ">=", invFrom),
    where("invoiceDate", "<=", invTo),
    orderBy("invoiceDate", "desc"),
  )

  const [invSnap, euerCostGroups, vatCostGroups, pauschalDocs, assetDocs, userSnap] = await Promise.all([
    getDocs(invQ),
    Promise.all(years.map((y) => fetchBillsForEuerYear(userId, y))),
    Promise.all(years.map((y) => fetchBillsForVatPeriod(userId, y))),
    fetchPauschalCostsForUser(userId),
    fetchAssetsForUser(userId),
    getDoc(doc(db, "bytebills-users", userId)),
  ])

  const invoicesRaw: Array<Record<string, unknown> & { type?: string }> = []
  invSnap.forEach((d) => {
    const data = d.data() as Record<string, unknown>
    const ymd = revenueInvoiceReportingYmd(data)
    if (!ymd || ymd < keepFrom || ymd > keepTo) return
    if (isCancelledRevenueInvoice(data)) return
    invoicesRaw.push({ ...data, id: d.id, type: "invoices" })
  })

  const bmfYears = new Set<number>()
  for (const inv of invoicesRaw) {
    const y = collectBmfYearsFromInvoiceDoc(inv)
    if (y != null) bmfYears.add(y)
  }
  const bmf = await fetchMergedBmfRatesByMonth(db, userId, bmfYears)
  const invoices = enrichRevenueDocsWithBmfReportEur(invoicesRaw, bmf)

  const euerCosts = mergeCostDocsById(...euerCostGroups)
  const vatCosts = mergeCostDocsById(...vatCostGroups)

  const euerYearInvoices = invoices.filter((inv) => {
    const ymd = revenueInvoiceReportingYmd(inv)
    return ymd != null && ymd.startsWith(`${year}-`)
  })
  const euerYearCosts = euerCosts.filter((c) => c.euerYear === year)
  const euerYearVat = vatCosts.filter((c) => c.vatYear === year)
  const euer = aggregateEurAnnualSummary(euerYearInvoices, euerYearCosts, {
    calendarYear: year,
    pauschalDocs,
    assetDocs,
    vatBills: euerYearVat,
  })

  const companies = (userSnap.exists() ? userSnap.data().companies : null) as Array<Record<string, unknown>> | undefined
  const companyDoc = companies?.find((c) => c.isDefault === true) ?? companies?.[0] ?? null
  const details = (companyDoc?.businessDetails ?? {}) as Record<string, unknown>
  const company: BwaCompanyHeader = {
    name: String(companyDoc?.name ?? ""),
    email: String(details.email ?? ""),
  }

  return {
    year,
    month,
    invoices,
    euerCosts,
    vatCosts,
    pauschalDocs,
    assetDocs,
    euer,
    company,
  }
}

export function bwa43ForMonth(
  payload: BwaEuerYearPayload,
  month: number,
): { month: Bwa43Amounts; last6: Bwa43Amounts } {
  const { year, invoices, euerCosts, vatCosts, pauschalDocs, assetDocs } = payload
  const base = { invoices, euerCosts, vatCosts, pauschalDocs, assetDocs }
  return {
    month: aggregateBwa43ForRange({ ...base, range: bwa43MonthRange(year, month) }),
    last6: aggregateBwa43ForRange({ ...base, range: bwa43Last6MonthsRange(year, month) }),
  }
}
