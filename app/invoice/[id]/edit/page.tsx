"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/components/ui/use-toast"
import { InvoiceForm } from "@/components/invoices/invoice-form-edit"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function EditInvoicePage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
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
        // Fetch invoice
        const invoiceDoc = await getDoc(doc(db, "invoices", params.id))

        if (!invoiceDoc.exists()) {
          toast({
            title: "Invoice not found",
            description: "The requested invoice does not exist.",
            variant: "destructive",
          })
          router.push("/invoices")
          return
        }

        const invoiceData = {
          id: invoiceDoc.id,
          ...invoiceDoc.data(),
        }

        // Check if the invoice belongs to the current user
        if (invoiceData.userId !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to edit this invoice.",
            variant: "destructive",
          })
          router.push("/invoices")
          return
        }

        setInvoice(invoiceData)

        // Fetch user data to get companies
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          setCompanies(userData.companies || [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load invoice data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingData(false)
      }
    }

    if (user && params.id) {
      fetchData()
    }
  }, [user, params.id, router])

  if (loading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!invoice || companies.length === 0) {
    return <div className="flex min-h-screen items-center justify-center">Invoice data not found</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/${params.id}`)} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Invoice</h1>
            <p className="text-muted-foreground">Update invoice #{invoice.invoiceNumber}</p>
          </div>
        </div>

        <InvoiceForm userId={user.uid} companies={companies} invoice={invoice} invoiceId={params.id} />
      </main>
    </>
  )
}

