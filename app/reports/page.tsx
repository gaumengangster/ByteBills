"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { collection, query, where, getDocs, orderBy, Query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format, subMonths, getYear } from "date-fns"
import {
  FileText,
  Receipt,
  TruckIcon,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Percent,
  Landmark,
  Wallet,
  ScrollText,
} from "lucide-react"
import { RevenueChart } from "@/components/reports/revenue-chart"
import { DocumentsChart } from "@/components/reports/documents-chart"
import { TopClientsTable } from "@/components/reports/top-clients-table"
import { DocumentStatusChart } from "@/components/reports/document-status-chart"
import { MonthlyComparisonChart } from "@/components/reports/monthly-comparison-chart"
import { resolveClientCountryCode } from "@/lib/client-country"
import {
  aggregateElsterQuarterForDocuments,
  type ElsterQuarterSummary,
  type ElsterZmRow,
} from "@/lib/elster-quarter"
import { getElsterReportUi, getEurReportUi, getReportsDashboardUi } from "@/lib/translations"
import { aggregateEurAnnualSummary, type EurAnnualSummary } from "@/lib/eur-annual-summary"
import { fetchPauschalCostsForUser, fetchAssetsForUser } from "@/lib/fetch-pauschal-assets"
import { sumBillsVatAmountEur } from "@/lib/report-eur-rates"
import { fetchBillsInDateRange, fetchBillsForVatPeriod, fetchBillsForEuerYear } from "@/lib/report-fetch-bills"
import {
  invoiceTaxEurForReport,
  invoiceTotalEurForReport,
} from "@/lib/revenue-document-eur"
import {
  invoiceDateYmdBoundsForVatReportingYear,
  revenueInvoiceMatchesCalendarYear,
  revenueInvoiceMatchesVatCalendarQuarter,
} from "@/lib/reporting-flags"
import {
  collectBmfYearsFromInvoiceDoc,
  collectBmfYearsFromReceiptDoc,
  enrichRevenueDocsWithBmfReportEur,
  fetchMergedBmfRatesByMonth,
} from "@/lib/bmf-rates-report"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


interface Document {
  id: string;
  type: 'invoices' | 'receipts' | 'deliveryNotes' | 'proformaInvoices';
  status?: string;
  [key: string]: any; // for other document properties
}

interface DocumentStatusChartProps {
  documents: Document[];
}

/** Each collection filtered by its business date (invoice, receipt, delivery), not `createdAt`. */
function buildReportRangeQuery(docType: string, userId: string, startStr: string, endStr: string): Query {
  if (docType === "invoices") {
    return query(
      collection(db, "invoices"),
      where("userId", "==", userId),
      where("invoiceDate", ">=", startStr),
      where("invoiceDate", "<=", endStr),
      orderBy("invoiceDate", "desc"),
    )
  }
  if (docType === "receipts") {
    return query(
      collection(db, "receipts"),
      where("userId", "==", userId),
      where("receiptDate", ">=", startStr),
      where("receiptDate", "<=", endStr),
      orderBy("receiptDate", "desc"),
    )
  }
  if (docType === "deliveryNotes") {
    return query(
      collection(db, "deliveryNotes"),
      where("userId", "==", userId),
      where("deliveryDate", ">=", startStr),
      where("deliveryDate", "<=", endStr),
      orderBy("deliveryDate", "desc"),
    )
  }
  if (docType === "proformaInvoices") {
    return query(
      collection(db, "proformaInvoices"),
      where("userId", "==", userId),
      where("invoiceDate", ">=", startStr),
      where("invoiceDate", "<=", endStr),
      orderBy("invoiceDate", "desc"),
    )
  }
  return query(
    collection(db, docType),
    where("userId", "==", userId),
    where("createdAt", ">=", startStr),
    where("createdAt", "<=", endStr),
    orderBy("createdAt", "desc"),
  )
}

function getQuarterBounds(year: number, quarter: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const endMonth = startMonth + 2
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/** Most recent quarter first: e.g. Q1 2026, Q4 2025, Q3 2025, Q2 2025 (from today). */
function getLast4QuartersFromNow(): { value: string; label: string }[] {
  const now = new Date()
  let y = getYear(now)
  let q = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < 4; i++) {
    out.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` })
    q -= 1
    if (q < 1) {
      q = 4
      y -= 1
    }
  }
  return out
}

const QUARTER_TF = /^(\d{4})-Q([1-4])$/

export default function ReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [timeframe, setTimeframe] = useState(() => getLast4QuartersFromNow()[0].value)
  const last4Quarters = useMemo(() => getLast4QuartersFromNow(), [])
  /** True only when the period dropdown is a calendar quarter (`YYYY-Qn`), not "Last 30 days" etc. */
  const isQuarterTimeframe = useMemo(() => QUARTER_TF.test(timeframe), [timeframe])
  const isYearTimeframe = useMemo(
    () => timeframe === "thisYear" || timeframe === "lastYear",
    [timeframe],
  )
  const elsterUi = useMemo(() => getElsterReportUi("en"), [])
  const eurUi = useMemo(() => getEurReportUi("en"), [])
  const reportsDash = useMemo(() => getReportsDashboardUi("en"), [])
  const [loadingData, setLoadingData] = useState(true)
  const [reportData, setReportData] = useState<any>({
    summary: {
      totalRevenue: 0,
      totalDocuments: 0,
      totalClients: 0,
      averageValue: 0,
      invoicesCount: 0,
      receiptsCount: 0,
      deliveryNotesCount: 0,
      proformaInvoicesCount: 0,
      revenueChange: 0,
      documentsChange: 0,
      totalVatReceived: 0,
      previousPeriodVat: 0,
      vatChange: 0,
      totalVatSpent: 0,
      previousPeriodVatSpent: 0,
      vatSpentChange: 0,
    },
    documents: [],
    clients: [],
    elster: null as ElsterQuarterSummary | null,
    eur: null as EurAnnualSummary | null,
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchReportData = async () => {
      if (!user) return

      setLoadingData(true)

      try {
        // Calculate date range based on selected timeframe
        let startDate = new Date()
        let endDate = new Date()

        const quarterMatch = timeframe.match(QUARTER_TF)
        if (quarterMatch) {
          const y = parseInt(quarterMatch[1], 10)
          const q = parseInt(quarterMatch[2], 10) as 1 | 2 | 3 | 4
          const b = getQuarterBounds(y, q)
          startDate = b.start
          endDate = b.end
        } else {
          switch (timeframe) {
            case "last30Days":
              startDate = new Date(new Date().setDate(new Date().getDate() - 30))
              break
            case "last3Months":
              startDate = subMonths(new Date(), 3)
              break
            case "last6Months":
              startDate = subMonths(new Date(), 6)
              break
            case "thisYear":
              startDate = new Date(getYear(new Date()), 0, 1)
              break
            case "lastYear":
              startDate = new Date(getYear(new Date()) - 1, 0, 1)
              endDate = new Date(getYear(new Date()) - 1, 11, 31)
              break
            default:
              startDate = subMonths(new Date(), 6)
          }
        }

        /** EÜR / tax-period calendar year for issued invoices (Leistungsdatum year); used with {@link revenueInvoiceMatchesCalendarYear}. */
        const reportCalendarYear =
          timeframe === "thisYear" || timeframe === "lastYear" ? getYear(endDate) : null

        // Format dates for Firestore queries
        const startDateStr = startDate.toISOString()
        const endDateStr = endDate.toISOString()

        // Fetch all document types
        const documentTypes = ["invoices", "receipts", "deliveryNotes", "proformaInvoices"]
        const allDocuments: any[] = []
        const documentCounts: Record<string, number> = {}
        const clientSet = new Set<string>()

        // Previous period for comparison (same calendar quarter one year ago when a quarter is selected)
        let previousStartDate: Date
        let previousEndDate: Date
        const prevQuarterMatch = timeframe.match(QUARTER_TF)
        if (prevQuarterMatch) {
          const y = parseInt(prevQuarterMatch[1], 10) - 1
          const q = parseInt(prevQuarterMatch[2], 10) as 1 | 2 | 3 | 4
          const prev = getQuarterBounds(y, q)
          previousStartDate = prev.start
          previousEndDate = prev.end
        } else {
          const periodLength = endDate.getTime() - startDate.getTime()
          previousStartDate = new Date(startDate.getTime() - periodLength)
          previousEndDate = new Date(endDate.getTime() - periodLength)
        }
        const previousStartDateStr = previousStartDate.toISOString()
        const previousEndDateStr = previousEndDate.toISOString()

        let previousPeriodDocuments = 0
        const previousSnapshotRows: { docType: string; data: Record<string, unknown> }[] = []

        // Fetch current period data. Quarter view: wide `invoiceDate` + VAT quarter filter. Year view (EÜR):
        // wide window + `taxDate` calendar year filter so income matches `quartal` / EÜR year.
        for (const docType of documentTypes) {
          let rangeStart = startDateStr
          let rangeEnd = endDateStr
          if (quarterMatch && (docType === "invoices" || docType === "proformaInvoices")) {
            const y = parseInt(quarterMatch[1], 10)
            const b = invoiceDateYmdBoundsForVatReportingYear(y)
            rangeStart = b.from
            rangeEnd = b.to
          } else if (reportCalendarYear != null && (docType === "invoices" || docType === "proformaInvoices")) {
            const b = invoiceDateYmdBoundsForVatReportingYear(reportCalendarYear)
            rangeStart = b.from
            rangeEnd = b.to
          }

          const q = buildReportRangeQuery(docType, user.uid, rangeStart, rangeEnd)

          const snapshot = await getDocs(q)
          let included = 0

          snapshot.forEach((doc) => {
            const data = doc.data()
            if (quarterMatch && (docType === "invoices" || docType === "proformaInvoices")) {
              const y = parseInt(quarterMatch[1], 10)
              const qn = parseInt(quarterMatch[2], 10) as 1 | 2 | 3 | 4
              if (!revenueInvoiceMatchesVatCalendarQuarter(data as Record<string, unknown>, y, qn)) return
            } else if (reportCalendarYear != null && (docType === "invoices" || docType === "proformaInvoices")) {
              if (!revenueInvoiceMatchesCalendarYear(data as Record<string, unknown>, reportCalendarYear)) return
            }
            included++
            // Spread first so `id` / `type` always reflect the Firestore collection (not overwritten by `data.type` etc.)
            allDocuments.push({
              ...data,
              id: doc.id,
              type: docType,
            })

            if (data.clientDetails?.name) {
              clientSet.add(data.clientDetails.name)
            }
          })
          documentCounts[docType] = included
        }

        const billsInRange = await fetchBillsInDateRange(user.uid, startDate, endDate)

        // For VAT calculations: use vatYear/vatQuarter fields on the document.
        // For EÜR calculations: use euerYear field on the document.
        // Fall back to billsInRange (expenseDate) for non-quarter/non-year timeframes.
        let vatBills: Record<string, unknown>[] = billsInRange
        let euerBills: Record<string, unknown>[] = billsInRange
        if (quarterMatch) {
          const qYear = parseInt(quarterMatch[1], 10)
          const qNum  = `Q${quarterMatch[2]}` as "Q1" | "Q2" | "Q3" | "Q4"
          vatBills  = await fetchBillsForVatPeriod(user.uid, qYear, qNum)
          euerBills = vatBills // quarter view: same set for both
        } else if (timeframe === "thisYear" || timeframe === "lastYear") {
          const reportYear = getYear(endDate)
          ;[vatBills, euerBills] = await Promise.all([
            fetchBillsForVatPeriod(user.uid, reportYear),
            fetchBillsForEuerYear(user.uid, reportYear),
          ])
        }

        // Fetch previous period data for comparison
        for (const docType of documentTypes) {
          let prevRangeStart = previousStartDateStr
          let prevRangeEnd = previousEndDateStr
          if (prevQuarterMatch && (docType === "invoices" || docType === "proformaInvoices")) {
            const py = parseInt(prevQuarterMatch[1], 10) - 1
            const b = invoiceDateYmdBoundsForVatReportingYear(py)
            prevRangeStart = b.from
            prevRangeEnd = b.to
          }

          const q = buildReportRangeQuery(docType, user.uid, prevRangeStart, prevRangeEnd)

          const snapshot = await getDocs(q)
          let prevIncluded = 0

          snapshot.forEach((doc) => {
            const data = doc.data() as Record<string, unknown>
            if (prevQuarterMatch && (docType === "invoices" || docType === "proformaInvoices")) {
              const py = parseInt(prevQuarterMatch[1], 10) - 1
              const qn = parseInt(prevQuarterMatch[2], 10) as 1 | 2 | 3 | 4
              if (!revenueInvoiceMatchesVatCalendarQuarter(data, py, qn)) return
            }
            prevIncluded++
            previousSnapshotRows.push({ docType, data })
          })
          previousPeriodDocuments += prevIncluded
        }

        // Previous period VAT: use vatYear-based fetch when on a quarter view
        let previousVatBills: Record<string, unknown>[]
        if (prevQuarterMatch) {
          const pYear = parseInt(prevQuarterMatch[1], 10) - 1
          const pNum  = `Q${prevQuarterMatch[2]}` as "Q1" | "Q2" | "Q3" | "Q4"
          previousVatBills = await fetchBillsForVatPeriod(user.uid, pYear, pNum)
        } else {
          previousVatBills = await fetchBillsInDateRange(user.uid, previousStartDate, previousEndDate)
        }
        const previousBillsInRange = previousVatBills

        const bmfYears = new Set<number>()
        for (const doc of allDocuments) {
          if (doc.type === "invoices") {
            const y = collectBmfYearsFromInvoiceDoc(doc as Record<string, unknown>)
            if (y != null) bmfYears.add(y)
          } else if (doc.type === "receipts") {
            const y = collectBmfYearsFromReceiptDoc(doc as Record<string, unknown>)
            if (y != null) bmfYears.add(y)
          }
        }
        for (const row of previousSnapshotRows) {
          const syn = { ...row.data, type: row.docType } as Record<string, unknown>
          if (row.docType === "invoices") {
            const y = collectBmfYearsFromInvoiceDoc(syn)
            if (y != null) bmfYears.add(y)
          } else if (row.docType === "receipts") {
            const y = collectBmfYearsFromReceiptDoc(syn)
            if (y != null) bmfYears.add(y)
          }
        }

        let bmfMerged: Record<string, Record<string, number>> = {}
        try {
          bmfMerged = await fetchMergedBmfRatesByMonth(db, user.uid, bmfYears)
        } catch (e) {
          console.error("BMF rates for reports:", e)
        }

        const documentsForReport = enrichRevenueDocsWithBmfReportEur(
          allDocuments as (Record<string, unknown> & { type?: string })[],
          Object.keys(bmfMerged).length > 0 ? bmfMerged : null,
        )

        const previousEnriched = enrichRevenueDocsWithBmfReportEur(
          previousSnapshotRows.map((row) => ({ ...row.data, type: row.docType })) as (Record<
            string,
            unknown
          > & { type?: string })[],
          Object.keys(bmfMerged).length > 0 ? bmfMerged : null,
        )

        let totalRevenue = 0
        for (const doc of documentsForReport) {
          if (doc.type !== "invoices") continue
          totalRevenue += invoiceTotalEurForReport(doc as Record<string, unknown>)
        }

        let previousPeriodRevenue = 0
        let previousPeriodVat = 0
        for (const doc of previousEnriched) {
          if (doc.type !== "invoices") continue
          previousPeriodRevenue += invoiceTotalEurForReport(doc as Record<string, unknown>)
          previousPeriodVat += invoiceTaxEurForReport(doc as Record<string, unknown>)
        }

        // Calculate percentage changes (100% only when prior period was 0 but current is not)
        const revenueChange =
          previousPeriodRevenue === 0
            ? totalRevenue === 0
              ? 0
              : 100
            : ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100

        const documentsChange =
          previousPeriodDocuments === 0
            ? documentsForReport.length === 0
              ? 0
              : 100
            : ((documentsForReport.length - previousPeriodDocuments) / previousPeriodDocuments) * 100

        // Average invoice amount (EUR): same basis as Total Revenue (invoices only)
        const invoicesCount = documentCounts.invoices || 0
        const averageValue = invoicesCount > 0 ? totalRevenue / invoicesCount : 0

        // Process client data for top clients (by revenue)
        type ClientAgg = {
          name: string
          vatId: string
          country: string | null
          serviceDescriptions: Set<string>
          revenue: number
          invoiceCount: number
          receiptCount: number
        }

        const clientData: Record<string, ClientAgg> = {}

        documentsForReport.forEach((doc) => {
          if (doc.type !== "invoices") return

          const inv = doc as Record<string, unknown> & {
            clientDetails?: { name?: string; vatNumber?: string; country?: string; address?: string }
            items?: unknown[]
          }
          const clientName = inv.clientDetails?.name || "Unknown Client"

          if (!clientData[clientName]) {
            clientData[clientName] = {
              name: clientName,
              vatId: "",
              country: null,
              serviceDescriptions: new Set<string>(),
              revenue: 0,
              invoiceCount: 0,
              receiptCount: 0,
            }
          }

          const agg = clientData[clientName]
          const vat = String(inv.clientDetails?.vatNumber ?? "").trim()
          if (vat && !agg.vatId) {
            agg.vatId = vat
          }

          const cc = resolveClientCountryCode(
            inv.clientDetails as Parameters<typeof resolveClientCountryCode>[0],
          )
          if (cc && !agg.country) {
            agg.country = cc
          }

          if (inv.items && Array.isArray(inv.items)) {
            for (const item of inv.items) {
              const desc =
                typeof (item as { description?: string })?.description === "string"
                  ? (item as { description: string }).description.trim()
                  : ""
              if (desc) {
                agg.serviceDescriptions.add(desc)
              }
            }
          }

          agg.invoiceCount += 1
          agg.revenue += invoiceTotalEurForReport(inv)
        })

        documentsForReport.forEach((doc) => {
          if (doc.type !== "receipts") return
          const rec = doc as Record<string, unknown> & { clientDetails?: { name?: string } }
          const clientName = rec.clientDetails?.name || "Unknown Client"
          const agg = clientData[clientName]
          if (!agg) return
          agg.receiptCount += 1
        })

        const topClients = Object.values(clientData)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((c) => ({
            name: c.name,
            vatId: c.vatId || "—",
            country: c.country || "—",
            invoiceCount: c.invoiceCount,
            receiptCount: c.receiptCount,
            serviceDescriptions: Array.from(c.serviceDescriptions).sort().join("; "),
            revenue: c.revenue,
            averageValue: c.invoiceCount > 0 ? c.revenue / c.invoiceCount : 0,
          }))

        // VAT received: `invoices` collection only (taxEur); receipts / proforma / delivery notes excluded
        let totalVatReceived = 0
        for (const doc of documentsForReport) {
          if (doc.type !== "invoices") continue
          totalVatReceived += invoiceTaxEurForReport(doc as Record<string, unknown>)
        }

        const totalVatSpent = sumBillsVatAmountEur(vatBills)
        const previousPeriodVatSpent = sumBillsVatAmountEur(previousBillsInRange)

        const previousVatSafe = Number.isFinite(previousPeriodVat) ? previousPeriodVat : 0
        const totalVatSafe = Number.isFinite(totalVatReceived) ? totalVatReceived : 0
        const vatChange =
          previousVatSafe === 0
            ? totalVatSafe === 0
              ? 0
              : 100
            : ((totalVatSafe - previousVatSafe) / previousVatSafe) * 100

        const previousVatSpentSafe = Number.isFinite(previousPeriodVatSpent) ? previousPeriodVatSpent : 0
        const totalVatSpentSafe = Number.isFinite(totalVatSpent) ? totalVatSpent : 0
        const vatSpentChange =
          previousVatSpentSafe === 0
            ? totalVatSpentSafe === 0
              ? 0
              : 100
            : ((totalVatSpentSafe - previousVatSpentSafe) / previousVatSpentSafe) * 100

        const elster = quarterMatch
          ? aggregateElsterQuarterForDocuments(documentsForReport, vatBills)
          : null

        let eur: EurAnnualSummary | null = null
        if (timeframe === "thisYear" || timeframe === "lastYear") {
          const [pauschalDocs, assetDocs] = await Promise.all([
            fetchPauschalCostsForUser(user.uid),
            fetchAssetsForUser(user.uid),
          ])
          const calendarYear = getYear(endDate)
          eur = aggregateEurAnnualSummary(documentsForReport, euerBills, {
            calendarYear,
            pauschalDocs,
            assetDocs,
            vatBills,
          })
        }

        setReportData({
          summary: {
            totalRevenue,
            totalDocuments: documentsForReport.length,
            totalClients: clientSet.size,
            averageValue,
            invoicesCount: documentCounts.invoices || 0,
            receiptsCount: documentCounts.receipts || 0,
            deliveryNotesCount: documentCounts.deliveryNotes || 0,
            proformaInvoicesCount: documentCounts.proformaInvoices || 0,
            revenueChange,
            documentsChange,
            totalVatReceived: totalVatSafe,
            previousPeriodVat: previousVatSafe,
            vatChange: Number.isFinite(vatChange) ? vatChange : 100,
            totalVatSpent: totalVatSpentSafe,
            previousPeriodVatSpent: previousVatSpentSafe,
            vatSpentChange: Number.isFinite(vatSpentChange) ? vatSpentChange : 100,
          },
          documents: documentsForReport,
          clients: topClients,
          elster,
          eur,
          timeframe: {
            startDate,
            endDate,
          },
        })
      } catch (error) {
        console.error("Error fetching report data:", error)
      } finally {
        setLoadingData(false)
      }
    }

    if (user) {
      fetchReportData()
    }
  }, [user, timeframe])

  const formatEur = (amount: number | undefined | null, maximumFractionDigits = 2) => {
    const n = typeof amount === "number" ? amount : Number(amount)
    const v = Number.isFinite(n) ? n : 0
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: maximumFractionDigits,
      maximumFractionDigits,
    }).format(v)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="min-w-0 md:flex-1">
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Gain insights into your business performance</p>
          </div>

          <div className="ml-auto flex w-fit max-w-full shrink-0 flex-col items-end gap-1">
            <Label
              htmlFor="reporting-period"
              className="text-right text-xs text-muted-foreground whitespace-nowrap"
            >
              Select reporting period
            </Label>
            <Select
              value={timeframe}
              onValueChange={(value) => {
                setLoadingData(true)
                setTimeframe(value)
              }}
            >
              <SelectTrigger id="reporting-period" className="h-8 w-[128px] min-w-0 text-xs">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {last4Quarters.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="last30Days">Last 30 days</SelectItem>
                <SelectItem value="last3Months">Last 3 months</SelectItem>
                <SelectItem value="last6Months">Last 6 months</SelectItem>
                <SelectItem value="thisYear">This year</SelectItem>
                <SelectItem value="lastYear">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading report data...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <StatCard 
                title={reportsDash.totalRevenueInvoicesTitle} 
                value={formatEur(reportData.summary.totalRevenue)}
                icon={<DollarSign className="h-5 w-5" />}
                change={reportData.summary.revenueChange}
              />
              <StatCard
                title={reportsDash.vatReceivedInvoicesTitle}
                value={formatEur(reportData.summary.totalVatReceived)}
                icon={<Percent className="h-5 w-5" />}
                change={reportData.summary.vatChange}
                secondaryText={
                  [
                    reportsDash.vatReceivedInvoicesSecondary,
                    (reportData.summary.previousPeriodVat ?? 0) !== 0
                      ? `Previous: ${formatEur(reportData.summary.previousPeriodVat ?? 0)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
              <StatCard
                title={reportsDash.vatPaidCostsTitle}
                value={formatEur(reportData.summary.totalVatSpent)}
                icon={<Wallet className="h-5 w-5" />}
                change={reportData.summary.vatSpentChange}
                secondaryText={
                  [
                    reportsDash.vatPaidCostsSecondary,
                    (reportData.summary.previousPeriodVatSpent ?? 0) !== 0
                      ? `Previous: ${formatEur(reportData.summary.previousPeriodVatSpent ?? 0)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
              <StatCard 
                title="Total Documents" 
                value={reportData.summary.totalDocuments.toString()}
                icon={<FileText className="h-5 w-5" />}
                change={reportData.summary.documentsChange}
              />
              <StatCard 
                title="Unique Clients" 
                value={reportData.summary.totalClients.toString()}
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                title="Average invoice"
                value={formatEur(reportData.summary.averageValue)}
                icon={<Calculator className="h-5 w-5" />}
                secondaryText="EUR per invoice in period"
              />
            </div>

            {isQuarterTimeframe && reportData.elster ? (
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-start gap-2">
                    <Landmark className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <CardTitle>{elsterUi.cardTitle}</CardTitle>
                      <CardDescription>{elsterUi.cardDescription}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[140px]">{elsterUi.tableItem}</TableHead>
                          <TableHead className="min-w-[100px]">{elsterUi.tableElsterLine}</TableHead>
                          <TableHead className="text-right min-w-[100px]">{elsterUi.tableEur}</TableHead>
                          <TableHead className="min-w-[220px]">{elsterUi.tableDescription}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{elsterUi.rowReceivedVatInvoiceLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {elsterUi.rowReceivedVatInvoiceLineRef}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.elster.receivedVatInvoicesEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {elsterUi.rowReceivedVatInvoiceDescription}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{elsterUi.rowPaidVatCostsLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{elsterUi.rowPaidVatCostsLineRef}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.elster.paidVatCostsEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{elsterUi.rowPaidVatCostsDescription}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{elsterUi.rowTaxFreeLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{elsterUi.rowTaxFreeLineRef}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.elster.taxFreeNetInvoicesEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{elsterUi.rowTaxFreeDescription}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {elsterUi.costsInTotalNote.replace("{count}", String(reportData.elster.costsBillCount))}
                  </p>
                  <div>
                    <h4 className="text-sm font-medium mb-2">{elsterUi.zmSectionTitle}</h4>
                    <div className="rounded-md border overflow-x-auto max-h-[280px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{elsterUi.zmColClient}</TableHead>
                            <TableHead>{elsterUi.zmColVatId}</TableHead>
                            <TableHead>{elsterUi.zmColCountry}</TableHead>
                            <TableHead className="text-right">{elsterUi.zmColNet}</TableHead>
                            <TableHead className="text-right">{elsterUi.zmColVat}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.elster.zmRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-muted-foreground text-sm">
                                {elsterUi.zmEmptyQuarter}
                              </TableCell>
                            </TableRow>
                          ) : (
                            reportData.elster.zmRows.map((row: ElsterZmRow) => (
                              <TableRow key={row.clientName}>
                                <TableCell className="font-medium">{row.clientName}</TableCell>
                                <TableCell>{row.vatId}</TableCell>
                                <TableCell>{row.countryCode}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatEur(row.nettoEur)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatEur(row.vatEur)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{elsterUi.zmFooterNote}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isYearTimeframe && reportData.eur ? (
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-start gap-2">
                    <ScrollText className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <CardTitle>{eurUi.cardTitle}</CardTitle>
                      <CardDescription>{eurUi.cardDescription}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">{eurUi.colNeed}</TableHead>
                          <TableHead className="min-w-[140px]">{eurUi.colFirestore}</TableHead>
                          <TableHead className="min-w-[140px]">{eurUi.colAnlage}</TableHead>
                          <TableHead className="text-right min-w-[100px]">{eurUi.colSum}</TableHead>
                          <TableHead className="min-w-[200px]">{eurUi.colNotes}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{eurUi.rowIncomeLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {eurUi.rowIncomeFirestore}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{eurUi.rowIncomeAnlage}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEur(reportData.eur.incomeNetEur)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eurUi.rowIncomeDesc}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{eurUi.rowExpenseLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {eurUi.rowExpenseFirestore}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{eurUi.rowExpenseAnlage}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEur(reportData.eur.expenseNetEur)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eurUi.rowExpenseDesc}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{eurUi.rowVatOutLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {eurUi.rowVatOutFirestore}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{eurUi.rowVatOutAnlage}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEur(reportData.eur.outputVatEur)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eurUi.rowVatOutDesc}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{eurUi.rowVatInLabel}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {eurUi.rowVatInFirestore}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{eurUi.rowVatInAnlage}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEur(reportData.eur.inputVatEur)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eurUi.rowVatInDesc}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Rent / home office (tagged bills)</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">bills · euerExpenseCategory</TableCell>
                          <TableCell className="text-muted-foreground text-sm">EÜR Z.52</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.eur.z52_homeoffice_mieteEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            Net from supplier bills tagged as home office / rent (optional field on save).
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Pauschale (flat rates)</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">cost_pauschale · calculatedAmount</TableCell>
                          <TableCell className="text-muted-foreground text-sm">EÜR Z.53</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.eur.z53_pauschalenEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            Home office, Verpflegung, internet Pauschale (excl. Pendler) overlapping the year.
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Commuting (Pendler)</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">cost_pauschale · mileage</TableCell>
                          <TableCell className="text-muted-foreground text-sm">EÜR Z.54</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.eur.z54_fahrtenEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">Pauschale category Pendler (km).</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Depreciation (AfA)</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">assets · linear</TableCell>
                          <TableCell className="text-muted-foreground text-sm">EÜR Z.44 / Z.45</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.eur.z44_abschreibungenEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            Linear AfA for the calendar year from recorded assets.
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Other expenses (tagged)</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">bills · euerExpenseCategory</TableCell>
                          <TableCell className="text-muted-foreground text-sm">EÜR Z.59</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEur(reportData.eur.z59_sonstigesEur)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            Net from bills tagged as software, internet, bank fees, travel, insurance, office supplies, or
                            education (optional).
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const end = reportData?.timeframe?.endDate as Date | undefined
                      const calendarYear =
                        end instanceof Date && !Number.isNaN(end.getTime())
                          ? getYear(end)
                          : getYear(new Date())
                      const filingDeadlineYear = calendarYear + 1
                      return eurUi.footerDeadline
                        .replace("{calendarYear}", String(calendarYear))
                        .replace("{filingDeadlineYear}", String(filingDeadlineYear))
                    })()}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Tabs defaultValue="overview" className="mb-8">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="clients">Clients</TabsTrigger>
                <TabsTrigger value="comparison">Compare</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="min-w-0 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Revenue Over Time</CardTitle>
                      <CardDescription>
                        {timeframe === "last30Days"
                          ? "Daily invoice revenue in EUR (totalEur per invoice). By Leistungsdatum (`taxDate`)."
                          : "Monthly invoice revenue in EUR (totalEur per invoice). By Leistungsdatum (`taxDate`)."}
                        {QUARTER_TF.test(timeframe)
                          ? " Quarter filter matches VAT calendar quarter from `taxDate` / persisted `quartal`."
                          : ""}
                        {timeframe === "thisYear" || timeframe === "lastYear"
                          ? " Twelve months (Jan–Dec); months with no revenue show €0."
                          : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0 overflow-hidden">
                      <RevenueChart
                        key={timeframe}
                        documents={reportData.documents}
                        timeframe={timeframe}
                        startDate={reportData?.timeframe?.startDate}
                        endDate={reportData?.timeframe?.endDate}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Document Breakdown</CardTitle>
                      <CardDescription>Distribution by document type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DocumentsChart
                        key={timeframe}
                        invoicesCount={reportData.summary.invoicesCount}
                        receiptsCount={reportData.summary.receiptsCount}
                        deliveryNotesCount={reportData.summary.deliveryNotesCount}
                        proformaInvoicesCount={reportData.summary.proformaInvoicesCount}
                      />
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-sm">Invoices</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-sm">Receipts</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                          <span className="text-sm">Delivery Notes</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                          <span className="text-sm">Proforma</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="documents">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Documents Over Time</CardTitle>
                      <CardDescription>
                        Documents per month: invoices by `taxDate`; proforma by invoice date; receipts and delivery notes
                        by receipt/delivery date
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] min-w-0 overflow-hidden">
                      <DocumentsChart
                        key={timeframe}
                        documents={reportData.documents}
                        timeframe={timeframe}
                        startDate={reportData?.timeframe?.startDate}
                        endDate={reportData?.timeframe?.endDate}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Document Status</CardTitle>
                      <CardDescription>
                        Status distribution of invoices in the selected period. Use the filter to focus on one status.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DocumentStatusChart
                        key={timeframe}
                        documents={reportData.documents.filter((doc: Document) => doc.type === "invoices")}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="clients">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Clients by Revenue</CardTitle>
                    <CardDescription>
                      Invoice revenue in EUR (totalEur); receipts excluded
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopClientsTable clients={reportData.clients} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue / document comparison</CardTitle>
                    <CardDescription>
                      Monthly invoice revenue (EUR) and total document count by month; revenue is invoices only
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px] min-w-0 overflow-hidden">
                    <MonthlyComparisonChart
                      key={timeframe}
                      documents={reportData.documents}
                      timeframe={timeframe}
                      startDate={reportData?.timeframe?.startDate}
                      endDate={reportData?.timeframe?.endDate}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <DocumentTypeCard 
                title="Invoices" 
                count={reportData.summary.invoicesCount}
                icon={<FileText className="h-5 w-5" />}
                href="/invoices"
              />
              <DocumentTypeCard 
                title="Receipts" 
                count={reportData.summary.receiptsCount}
                icon={<Receipt className="h-5 w-5" />}
                href="/receipts"
              />
              <DocumentTypeCard 
                title="Delivery Notes" 
                count={reportData.summary.deliveryNotesCount}
                icon={<TruckIcon className="h-5 w-5" />}
                href="/delivery-notes"
              />
              <DocumentTypeCard 
                title="Proforma Invoices" 
                count={reportData.summary.proformaInvoicesCount}
                icon={<FileText className="h-5 w-5" />}
                href="/proforma-invoices"
              />
            </div>
          </>
        )}
      </main>
    </>
  )
}

function StatCard({
  title,
  value,
  icon,
  change,
  secondaryText,
}: {
  title: string
  value: string
  icon: React.ReactNode
  change?: number
  /** Extra line (e.g. previous-period amount) shown below the main value */
  secondaryText?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {secondaryText ? (
          <p className="text-xs text-muted-foreground mt-1">{secondaryText}</p>
        ) : null}
        {typeof change !== "undefined" && Number.isFinite(change) && (
          <div className="flex items-center mt-1">
            {change === 0 ? (
              <p className="text-xs text-muted-foreground">No change from previous period</p>
            ) : (
              <>
                {change > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500 mr-1 shrink-0" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500 mr-1 shrink-0" />
                )}
                <p className={`text-xs ${change > 0 ? "text-green-500" : "text-red-500"}`}>
                  {change > 0 ? "Increased" : "Decreased"} by {Math.abs(change).toFixed(1)}% from
                  previous period
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentTypeCard({
  title,
  count,
  icon,
  href,
}: {
  title: string
  count: number
  icon: React.ReactNode
  href: string
}) {
  const router = useRouter()
  
  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(href)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <p className="text-xs text-muted-foreground mt-1">
          View all {title.toLowerCase()}
        </p>
      </CardContent>
    </Card>
  )
}

function Calculator(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  )
}
