"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Loader2, ArrowLeftRight } from "lucide-react"
import { BmfCsvYearTreeSection } from "@/components/exchange-rates/bmf-csv-year-tree-section"

export default function ExchangeRatesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ArrowLeftRight className="h-8 w-8 shrink-0" aria-hidden />
            Exchange rates
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Sync the BMF monthly CSV into one document per year under your user id (same style as invoices:{" "}
            <code className="text-xs">userId</code>, ISO <code className="text-xs">createdAt</code> /{" "}
            <code className="text-xs">updatedAt</code>, nested <code className="text-xs">ratesByMonth</code>). Invoices,
            receipts, and costs use only these Firestore rates for EUR conversion.
          </p>
        </header>

        <BmfCsvYearTreeSection user={user} />
      </main>
    </div>
  )
}
