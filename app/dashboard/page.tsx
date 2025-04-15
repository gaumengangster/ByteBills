"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Receipt, TruckIcon, Plus } from "lucide-react"
import Link from "next/link"
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [recentDocuments, setRecentDocuments] = useState<any[]>([])
  const [stats, setStats] = useState({
    invoices: 0,
    receipts: 0,
    deliveryNotes: 0,
    proformaInvoices: 0,
  })
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch stats
        const fetchStats = async (collectionName: string) => {
          const q = query(collection(db, collectionName), where("userId", "==", user.uid))
          const snapshot = await getDocs(q)
          return snapshot.size
        }

        const [invoices, receipts, deliveryNotes, proformaInvoices] = await Promise.all([
          fetchStats("invoices"),
          fetchStats("receipts"),
          fetchStats("deliveryNotes"),
          fetchStats("proformaInvoices"),
        ])

        setStats({
          invoices,
          receipts,
          deliveryNotes,
          proformaInvoices,
        })

        // Fetch recent documents
        const fetchRecent = async () => {
          const collections = ["invoices", "receipts", "deliveryNotes", "proformaInvoices"]
          const recentDocs: any[] = []

          for (const collectionName of collections) {
            const q = query(
              collection(db, collectionName),
              where("userId", "==", user.uid),
              orderBy("createdAt", "desc"),
              limit(2),
            )

            const snapshot = await getDocs(q)
            snapshot.forEach((doc) => {
              recentDocs.push({
                id: doc.id,
                type: collectionName,
                ...doc.data(),
              })
            })
          }

          return recentDocs
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        }

        const recentDocs = await fetchRecent()
        setRecentDocuments(recentDocs)
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoadingData(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome, {user.displayName || "User"}</h1>
          <p className="text-muted-foreground">Manage all your business documents with ByteBills</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Invoices" value={stats.invoices} icon={<FileText className="h-5 w-5" />} href="/invoices" />
          <StatCard title="Receipts" value={stats.receipts} icon={<Receipt className="h-5 w-5" />} href="/receipts" />
          <StatCard
            title="Delivery Notes"
            value={stats.deliveryNotes}
            icon={<TruckIcon className="h-5 w-5" />}
            href="/delivery-notes"
          />
          <StatCard
            title="Proforma Invoices"
            value={stats.proformaInvoices}
            icon={<FileText className="h-5 w-5" />}
            href="/proforma-invoices"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>Your recently created documents</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/reports">View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-4">Loading recent documents...</div>
                ) : recentDocuments.length > 0 ? (
                  <div className="space-y-4">
                    {recentDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center">
                          {doc.type === "invoices" && <FileText className="h-4 w-4 mr-2" />}
                          {doc.type === "receipts" && <Receipt className="h-4 w-4 mr-2" />}
                          {doc.type === "deliveryNotes" && <TruckIcon className="h-4 w-4 mr-2" />}
                          {doc.type === "proformaInvoices" && <FileText className="h-4 w-4 mr-2" />}
                          <div>
                            <p className="font-medium">
                              {doc.documentNumber || doc.receiptNumber || doc.deliveryNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/${doc.type}/${doc.id}`}>View</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No documents created yet</p>
                    <Button asChild className="mt-4">
                      <Link href="/invoices/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Create your first document
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Create new documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/invoices/new">
                    <FileText className="mr-2 h-4 w-4" />
                    New Invoice
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/receipts/new">
                    <Receipt className="mr-2 h-4 w-4" />
                    New Receipt
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/delivery-notes/new">
                    <TruckIcon className="mr-2 h-4 w-4" />
                    New Delivery Note
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/proforma-invoices/new">
                    <FileText className="mr-2 h-4 w-4" />
                    New Proforma Invoice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string
  value: number
  icon: React.ReactNode
  href: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          <Link href={href} className="hover:underline">
            View all {title.toLowerCase()}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

