import { collection, getDocs, orderBy, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  collectBmfYearsFromInvoiceDoc,
  enrichRevenueDocsWithBmfReportEur,
  fetchMergedBmfRatesByMonth,
} from "@/lib/bmf-rates-report"
import { mergeCostDocsById } from "@/lib/cost-report-aggregation"
import { aggregateEksForSixMonths, type EksDocs, type EksMonthGrid } from "@/lib/eks-aggregate"
import { eksSixMonthsEnding, eksMonthRange } from "@/lib/eks-model"
import { fetchPauschalCostsForUser } from "@/lib/fetch-pauschal-assets"
import { fetchBillsForCostYear, fetchBillsForEuerYear } from "@/lib/report-fetch-bills"

export type EksPeriodPayload = EksMonthGrid & {
  endYear: number
  endMonth: number
}

function lookbackInvoiceFromYmd(windowFrom: string): string {
  const y = Number(windowFrom.slice(0, 4)) - 2
  return `${y}-01-01`
}

export async function loadEksPeriod(userId: string, endYear: number, endMonth: number): Promise<EksPeriodPayload> {
  const months = eksSixMonthsEnding(endYear, endMonth)
  const first = eksMonthRange(months[0]!.year, months[0]!.month)
  const last = eksMonthRange(months[months.length - 1]!.year, months[months.length - 1]!.month)
  const invFrom = lookbackInvoiceFromYmd(first.from)
  const invTo = last.to

  const yearStart = Number(invFrom.slice(0, 4))
  const yearEnd = Number(last.to.slice(0, 4))
  const years: number[] = []
  for (let y = yearStart; y <= yearEnd; y++) years.push(y)

  const invQ = query(
    collection(db, "invoices"),
    where("userId", "==", userId),
    where("invoiceDate", ">=", invFrom),
    where("invoiceDate", "<=", invTo),
    orderBy("invoiceDate", "desc"),
  )

  const [invSnap, euerCostGroups, costYearGroups, pauschalDocs] = await Promise.all([
    getDocs(invQ),
    Promise.all(years.map((y) => fetchBillsForEuerYear(userId, y))),
    Promise.all(years.map((y) => fetchBillsForCostYear(userId, y))),
    fetchPauschalCostsForUser(userId),
  ])

  const invoicesRaw: Array<Record<string, unknown>> = []
  invSnap.forEach((d) => {
    invoicesRaw.push({ ...(d.data() as Record<string, unknown>), id: d.id, type: "invoices" })
  })

  const bmfYears = new Set<number>()
  for (const inv of invoicesRaw) {
    const y = collectBmfYearsFromInvoiceDoc(inv)
    if (y != null) bmfYears.add(y)
  }
  const bmf = await fetchMergedBmfRatesByMonth(db, userId, bmfYears)
  const invoices = enrichRevenueDocsWithBmfReportEur(invoicesRaw, bmf)

  const costs = mergeCostDocsById(...euerCostGroups, ...costYearGroups)

  const docs: EksDocs = { invoices, costs, pauschalDocs }
  const grid = aggregateEksForSixMonths(docs, endYear, endMonth)
  return { ...grid, endYear, endMonth }
}
