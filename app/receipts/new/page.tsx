"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { ReceiptForm } from "@/components/receipts/receipt-form"
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import { formatCurrency } from "@/lib/utils"
import { FileText, Loader2 } from "lucide-react"

export default function NewReceiptPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [loadingUserData, setLoadingUserData] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoicePickDone, setInvoicePickDone] = useState(false)
  const [prefillFromInvoice, setPrefillFromInvoice] = useState<{ id: string; data: Record<string, unknown> } | null>(
    null,
  )

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return

      try {
        const userDoc = await getDoc(doc(db, "bytebills-users", user.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoadingUserData(false)
      }
    }

    if (user) {
      fetchUserData()
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const q = query(collection(db, "invoices"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
        const snap = await getDocs(q)
        if (cancelled) return
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error(e)
        toast({
          title: "Could not load invoices",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoadingInvoices(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (loadingUserData) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <p>Loading company data...</p>
          </div>
        </main>
      </>
    )
  }

  if (!userData?.companies || userData.companies.length === 0) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col justify-center items-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-bold mb-2">No Company Setup</h2>
            <p className="text-muted-foreground mb-4">You need to set up a company before creating receipts.</p>
            <button onClick={() => router.push("/settings")} className="text-primary hover:underline">
              Go to Settings
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create New Receipt</h1>
          <p className="text-muted-foreground">
            {invoicePickDone
              ? "Review and adjust the receipt, then create it."
              : "Choose an invoice to pre-fill the receipt, or start from scratch."}
          </p>
        </div>

        {!invoicePickDone ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Select an invoice
              </CardTitle>
              <CardDescription>
                Pick an invoice to copy client, company, line items, and currency. You can still edit everything before
                saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingInvoices ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-muted-foreground py-4">
                  You have no invoices yet. Create a receipt without an invoice link, or create an invoice first.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right w-[120px]"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                          <TableCell>{inv.clientDetails?.name ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {inv.invoiceDate
                              ? (() => {
                                  try {
                                    return formatDocumentDateBerlin(inv.invoiceDate, "MMMM d, yyyy")
                                  } catch {
                                    return String(inv.invoiceDate)
                                  }
                                })()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.total, inv)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setPrefillFromInvoice({ id: inv.id, data: inv })
                                setInvoicePickDone(true)
                              }}
                            >
                              Use this invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPrefillFromInvoice(null)
                    setInvoicePickDone(true)
                  }}
                >
                  Create without invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReceiptForm
            userId={user.uid}
            companies={userData.companies}
            prefillFromInvoice={prefillFromInvoice}
          />
        )}
      </main>
    </>
  )
}
