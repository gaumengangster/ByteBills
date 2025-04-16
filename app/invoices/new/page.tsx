"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { InvoiceForm } from "@/components/invoices/invoice-form"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function NewInvoicePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [loadingUserData, setLoadingUserData] = useState(true)

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
            <p className="text-muted-foreground mb-4">You need to set up a company before creating invoices.</p>
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
          <h1 className="text-3xl font-bold">Create New Invoice</h1>
          <p className="text-muted-foreground">Fill in the details to create a new invoice</p>
        </div>

        <InvoiceForm userId={user.uid} companies={userData.companies} />
      </main>
    </>
  )
}

