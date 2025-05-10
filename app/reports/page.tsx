"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { subMonths, getYear } from "date-fns"
import { FileText, Receipt, TruckIcon, DollarSign, Users, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { RevenueChart } from "@/components/reports/revenue-chart"
import { DocumentsChart } from "@/components/reports/documents-chart"
import { TopClientsTable } from "@/components/reports/top-clients-table"
import { DocumentStatusChart } from "@/components/reports/document-status-chart"
import { MonthlyComparisonChart } from "@/components/reports/monthly-comparison-chart"

interface Document {
  id: string;
  type: 'invoices' | 'receipts' | 'deliveryNotes' | 'proformaInvoices';
  status?: string;
  [key: string]: any; // for other document properties
}

interface DocumentStatusChartProps {
  documents: Document[];
}


export default function ReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [timeframe, setTimeframe] = useState("last6Months")
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
    },
    documents: [],
    clients: [],
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

        // Format dates for Firestore queries
        const startDateStr = startDate.toISOString()
        const endDateStr = endDate.toISOString()

        // Fetch all document types
        const documentTypes = ["invoices", "receipts", "deliveryNotes", "proformaInvoices"]
        const allDocuments: any[] = []
        const documentCounts: Record<string, number> = {}
        const clientSet = new Set<string>()
        let totalRevenue = 0

        // Previous period for comparison
        const periodLength = endDate.getTime() - startDate.getTime()
        const previousStartDate = new Date(startDate.getTime() - periodLength)
        const previousEndDate = new Date(endDate.getTime() - periodLength)
        const previousStartDateStr = previousStartDate.toISOString()
        const previousEndDateStr = previousEndDate.toISOString()

        let previousPeriodRevenue = 0
        let previousPeriodDocuments = 0

        // Fetch current period data
        for (const docType of documentTypes) {
          const q = query(
            collection(db, docType),
            where("userId", "==", user.uid),
            where("createdAt", ">=", startDateStr),
            where("createdAt", "<=", endDateStr),
            orderBy("createdAt", "desc")
          )

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

            // Add to total revenue (only for invoices and receipts)
            if ((docType === "invoices" || docType === "receipts") && data.total) {
              totalRevenue += data.total
            }
          })
        }

        // Fetch previous period data for comparison
        for (const docType of documentTypes) {
          const q = query(
            collection(db, docType),
            where("userId", "==", user.uid),
            where("createdAt", ">=", previousStartDateStr),
            where("createdAt", "<=", previousEndDateStr)
          )

          const snapshot = await getDocs(q)
          previousPeriodDocuments += snapshot.size

          snapshot.forEach((doc) => {
            const data = doc.data()
            // Add to previous period revenue (only for invoices and receipts)
            if ((docType === "invoices" || docType === "receipts") && data.total) {
              previousPeriodRevenue += data.total
            }
          })
        }

        // Calculate percentage changes
        const revenueChange = previousPeriodRevenue === 0 
          ? 100 
          : ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        
        const documentsChange = previousPeriodDocuments === 0 
          ? 100 
          : ((allDocuments.length - previousPeriodDocuments) / previousPeriodDocuments) * 100

        // Calculate average value
        const averageValue = totalRevenue / (documentCounts.invoices + documentCounts.receipts || 1)

        // Process client data for top clients
        const clientData: Record<string, { name: string; revenue: number; documents: number }> = {}
        
        allDocuments.forEach(doc => {
          const clientName = doc.clientDetails?.name || "Unknown Client"
          
          if (!clientData[clientName]) {
            clientData[clientName] = {
              name: clientName,
              revenue: 0,
              documents: 0
            }
          }
          
          clientData[clientName].documents += 1
          
          if ((doc.type === "invoices" || doc.type === "receipts") && doc.total) {
            clientData[clientName].revenue += doc.total
          }
        })
        
        const topClients = Object.values(clientData)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)

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
          },
          documents: allDocuments,
          clients: topClients,
          timeframe: {
            startDate,
            endDate,
          }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Gain insights into your business performance</p>
          </div>

          <div className="w-full md:w-[240px]">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30Days">Last 30 Days</SelectItem>
                <SelectItem value="last3Months">Last 3 Months</SelectItem>
                <SelectItem value="last6Months">Last 6 Months</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard 
                title="Total Revenue" 
                value={formatCurrency(reportData.summary.totalRevenue)}
                icon={<DollarSign className="h-5 w-5" />}
                change={reportData.summary.revenueChange}
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
                value={formatCurrency(reportData.summary.averageValue)}
                icon={<Calculator className="h-5 w-5" />}
              />
            </div>

            <Tabs defaultValue="overview" className="mb-8">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="clients">Clients</TabsTrigger>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Revenue Over Time</CardTitle>
                      <CardDescription>
                        {timeframe === "last30Days" ? "Daily revenue for the past 30 days" :
                         timeframe === "last3Months" || timeframe === "last6Months" ? "Monthly revenue" :
                         "Monthly revenue for the selected year"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RevenueChart 
                        documents={reportData.documents} 
                        timeframe={timeframe}
                        startDate={reportData.timeframe.startDate}
                        endDate={reportData.timeframe.endDate}
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
                      <CardDescription>Number of documents created over time</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                      <DocumentsChart 
                        documents={reportData.documents}
                        timeframe={timeframe}
                        startDate={reportData.timeframe.startDate}
                        endDate={reportData.timeframe.endDate}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Document Status</CardTitle>
                      <CardDescription>Status distribution of invoices</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DocumentStatusChart 
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
                    <CardDescription>Your highest-value clients in the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopClientsTable clients={reportData.clients} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Comparison</CardTitle>
                    <CardDescription>Compare revenue and document count month by month</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    <MonthlyComparisonChart 
                      documents={reportData.documents}
                      timeframe={timeframe}
                      startDate={reportData.timeframe.startDate}
                      endDate={reportData.timeframe.endDate}
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
}: {
  title: string
  value: string
  icon: React.ReactNode
  change?: number
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {typeof change !== 'undefined' && (
          <div className="flex items-center mt-1">
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
            )}
            <p className={`text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change.toFixed(1)}% from previous period
            </p>
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
