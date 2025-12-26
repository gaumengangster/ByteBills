"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/components/ui/use-toast"
import { ReceiptFormEdit } from "@/components/receipts/receipt-form-edit"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [receipt, setReceipt] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const { id } = use(params)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch receipt
        const receiptDoc = await getDoc(doc(db, "receipts", id))

        if (!receiptDoc.exists()) {
          toast({
            title: "Receipt not found",
            description: "The requested receipt does not exist.",
            variant: "destructive",
          })
          router.push("/receipts")
          return
        }

        const receiptData = {
          id: receiptDoc.id,
          ...receiptDoc.data(),
        }

        // Check if the receipt belongs to the current user
        if (receiptData.id !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to edit this receipt.",
            variant: "destructive",
          })
          router.push("/receipts")
          return
        }

        setReceipt(receiptData)

        // Fetch user data to get companies
        const userDoc = await getDoc(doc(db, "bytebills-users", user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          setCompanies(userData.companies || [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load receipt data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingData(false)
      }
    }

    if (user && id) {
      fetchData()
    }
  }, [user, id, router])

  if (loading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!receipt || companies.length === 0) {
    return <div className="flex min-h-screen items-center justify-center">Receipt data not found</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/receipts/${id}`)} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Receipt</h1>
            <p className="text-muted-foreground">Update receipt #{receipt.receiptNumber}</p>
          </div>
        </div>

        {user ? (
          <ReceiptFormEdit userId={user.uid} companies={companies} receipt={receipt} receiptId={id} />
        ) : (
          <p>Loading user data...</p>
        )}
      </main>
    </>
  )
}
