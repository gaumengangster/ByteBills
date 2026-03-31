"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { AddCostWizard } from "@/components/costs/add-cost-wizard"
import { CostRegisterTab } from "@/components/costs/cost-register-tab"
import { Loader2, Plus } from "lucide-react"

export default function CostsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<"register" | "create">("register")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login")
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Costs</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              One flow only: upload vendor document, extract with AI, review and correct, then save.
            </p>
          </div>
          {mode === "register" ? (
            <Button className="shrink-0" onClick={() => setMode("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Add cost
            </Button>
          ) : null}
        </div>

        {mode === "create" ? (
          <AddCostWizard
            userId={user.uid}
            onSaved={() => {
              setRefreshKey((k) => k + 1)
              setMode("register")
            }}
            onCancel={() => setMode("register")}
          />
        ) : (
          <CostRegisterTab userId={user.uid} refreshKey={refreshKey} />
        )}
      </main>
    </div>
  )
}
