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
} from "lucide-react"
import { RevenueChart } from "@/components/reports/revenue-chart"
import { DocumentsChart } from "@/components/reports/documents-chart"
import { TopClientsTable } from "@/components/reports/top-clients-table"
import { DocumentStatusChart } from "@/components/reports/document-status-chart"
import { MonthlyComparisonChart } from "@/components/reports/monthly-comparison-chart"
import {
  convertAmountToEur,
  fetchEurRatesForDocumentDates,
  mergeEcbLiveRates,
  type EurRatesByDocumentDate,
  type EurReferenceRates,
} from "@/lib/eur-rates"
import { getRevenueDocumentDate } from "@/lib/revenue-document-date"
import { resolveClientCountryCode } from "@/lib/client-country"

function taxToEur(doc: { tax?: unknown; currency?: string }, eurRates: EurReferenceRates): number {
  const raw = doc.tax
  if (raw == null || raw === "") {
    return 0
  }
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    return 0
  }
  const eur = convertAmountToEur(n, doc.currency, eurRates)
  return Number.isFinite(eur) ? eur : 0
}

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
    },
    documents: [],
    clients: [],
    eurRatesByDocDate: null as EurRatesByDocumentDate | null,
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

        // Fetch current period data (revenue documents use invoice/receipt date)
        for (const docType of documentTypes) {
          const q = buildReportRangeQuery(docType, user.uid, startDateStr, endDateStr)

          const snapshot = await getDocs(q)
          documentCounts[docType] = snapshot.size

          snapshot.forEach((doc) => {
            const data = doc.data()
            allDocuments.push({
              id: doc.id,
              type: docType,
              ...data,
            })

            // Add client to unique set
            if (data.clientDetails?.name) {
              clientSet.add(data.clientDetails.name)
            }
          })
        }

        // Fetch previous period data for comparison
        for (const docType of documentTypes) {
          const q = buildReportRangeQuery(docType, user.uid, previousStartDateStr, previousEndDateStr)

          const snapshot = await getDocs(q)
          previousPeriodDocuments += snapshot.size

          snapshot.forEach((doc) => {
            previousSnapshotRows.push({ docType, data: doc.data() as Record<string, unknown> })
          })
        }

        const revenueDateKeys = new Set<string>()
        for (const doc of allDocuments) {
          if (doc.type === "invoices" || doc.type === "receipts") {
            const d = getRevenueDocumentDate(doc)
            if (!Number.isNaN(d.getTime())) {
              revenueDateKeys.add(format(d, "yyyy-MM-dd"))
            }
          }
        }
        for (const row of previousSnapshotRows) {
          if (row.docType === "invoices" || row.docType === "receipts") {
            const d = getRevenueDocumentDate({
              type: row.docType,
              invoiceDate: row.data.invoiceDate,
              receiptDate: row.data.receiptDate,
            })
            if (!Number.isNaN(d.getTime())) {
              revenueDateKeys.add(format(d, "yyyy-MM-dd"))
            }
          }
        }

        const eurRatesByDocDate = await fetchEurRatesForDocumentDates([...revenueDateKeys])

        const ratesForDoc = (doc: { type?: string; invoiceDate?: unknown; receiptDate?: unknown }) => {
          const d = getRevenueDocumentDate(doc)
          if (Number.isNaN(d.getTime())) {
            return mergeEcbLiveRates({})
          }
          const key = format(d, "yyyy-MM-dd")
          return eurRatesByDocDate[key] ?? mergeEcbLiveRates({})
        }

        let totalRevenue = 0
        for (const doc of allDocuments) {
          if ((doc.type === "invoices" || doc.type === "receipts") && doc.total) {
            totalRevenue += convertAmountToEur(doc.total, doc.currency, ratesForDoc(doc))
          }
        }

        let previousPeriodRevenue = 0
        let previousPeriodVat = 0
        for (const row of previousSnapshotRows) {
          const { docType, data } = row
          const synthetic = {
            type: docType,
            invoiceDate: data.invoiceDate,
            receiptDate: data.receiptDate,
          }
          const r = ratesForDoc(synthetic)
          if ((docType === "invoices" || docType === "receipts") && data.total) {
            previousPeriodRevenue += convertAmountToEur(
              data.total as number,
              data.currency as string | undefined,
              r,
            )
          }
          if (docType === "invoices" || docType === "receipts") {
            previousPeriodVat += taxToEur(data as { tax?: unknown; currency?: string }, r)
          }
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
            ? allDocuments.length === 0
              ? 0
              : 100
            : ((allDocuments.length - previousPeriodDocuments) / previousPeriodDocuments) * 100

        // Calculate average value
        const averageValue = totalRevenue / (documentCounts.invoices + documentCounts.receipts || 1)

        // Process client data for top clients (by revenue)
        type ClientAgg = {
          name: string
          vatId: string
          country: string | null
          serviceDescriptions: Set<string>
          revenue: number
          revenueDocCount: number
        }

        const clientData: Record<string, ClientAgg> = {}

        allDocuments.forEach((doc) => {
          const clientName = doc.clientDetails?.name || "Unknown Client"

          if (!clientData[clientName]) {
            clientData[clientName] = {
              name: clientName,
              vatId: "",
              country: null,
              serviceDescriptions: new Set<string>(),
              revenue: 0,
              revenueDocCount: 0,
            }
          }

          const row = clientData[clientName]
          const vat = String(doc.clientDetails?.vatNumber ?? "").trim()
          if (vat && !row.vatId) {
            row.vatId = vat
          }

          const cc = resolveClientCountryCode(doc.clientDetails)
          if (cc && !row.country) {
            row.country = cc
          }

          if (doc.items && Array.isArray(doc.items)) {
            for (const item of doc.items) {
              const desc =
                typeof (item as { description?: string })?.description === "string"
                  ? (item as { description: string }).description.trim()
                  : ""
              if (desc) {
                row.serviceDescriptions.add(desc)
              }
            }
          }

          if (doc.type === "invoices" || doc.type === "receipts") {
            row.revenueDocCount += 1
            if (doc.total) {
              row.revenue += convertAmountToEur(doc.total, doc.currency, ratesForDoc(doc))
            }
          }
        })

        const topClients = Object.values(clientData)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((c) => ({
            name: c.name,
            vatId: c.vatId || "—",
            country: c.country || "—",
            documentCount: c.revenueDocCount,
            serviceDescriptions: Array.from(c.serviceDescriptions).sort().join("; "),
            revenue: c.revenue,
            averageValue: c.revenueDocCount > 0 ? c.revenue / c.revenueDocCount : 0,
          }))

        let totalVatReceived = 0
        allDocuments.forEach((doc) => {
          if (doc.type === "invoices" || doc.type === "receipts") {
            totalVatReceived += taxToEur(doc, ratesForDoc(doc))
          }
        })

        const previousVatSafe = Number.isFinite(previousPeriodVat) ? previousPeriodVat : 0
        const totalVatSafe = Number.isFinite(totalVatReceived) ? totalVatReceived : 0
        const vatChange =
          previousVatSafe === 0
            ? totalVatSafe === 0
              ? 0
              : 100
            : ((totalVatSafe - previousVatSafe) / previousVatSafe) * 100

        setReportData({
          summary: {
            totalRevenue,
            totalDocuments: allDocuments.length,
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
          },
          documents: allDocuments,
          clients: topClients,
          eurRatesByDocDate,
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              <StatCard 
                title="Total Revenue" 
                value={formatEur(reportData.summary.totalRevenue)}
                icon={<DollarSign className="h-5 w-5" />}
                change={reportData.summary.revenueChange}
              />
              <StatCard
                title="VAT received"
                value={formatEur(reportData.summary.totalVatReceived)}
                icon={<Percent className="h-5 w-5" />}
                change={reportData.summary.vatChange}
                secondaryText={
                  (reportData.summary.previousPeriodVat ?? 0) !== 0
                    ? `Previous period: ${formatEur(reportData.summary.previousPeriodVat ?? 0)}`
                    : undefined
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
                title="Average Value" 
                value={formatEur(reportData.summary.averageValue)}
                icon={<Calculator className="h-5 w-5" />}
              />
            </div>

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
                          ? "Daily revenue in EUR (amounts converted from document currency). By invoice/receipt date."
                          : "Monthly revenue in EUR (amounts converted from document currency). By invoice/receipt date."}
                        {QUARTER_TF.test(timeframe)
                          ? " Calendar quarter (full quarter range for the selected year)."
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
                        eurRatesByDocDate={reportData.eurRatesByDocDate ?? undefined}
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
                        Documents per month by business date (invoice, receipt, delivery, or proforma date)
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
                      Revenue in EUR (converted from document currency)
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
                      Monthly revenue (EUR) and document count by month; same business dates as Documents Over Time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px] min-w-0 overflow-hidden">
                    <MonthlyComparisonChart
                      key={timeframe}
                      documents={reportData.documents}
                      timeframe={timeframe}
                      startDate={reportData?.timeframe?.startDate}
                      endDate={reportData?.timeframe?.endDate}
                      eurRatesByDocDate={reportData.eurRatesByDocDate ?? undefined}
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
