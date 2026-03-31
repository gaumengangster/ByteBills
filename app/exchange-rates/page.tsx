"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import type { EurRatesByDocumentDate, EurReferenceRates } from "@/lib/eur-rates"

const ECB_INDEX =
  "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"

function sortCurrencyCodes(codes: string[]): string[] {
  const u = [...new Set(codes.map((c) => c.toUpperCase()))]
  u.sort((a, b) => {
    if (a === "EUR") return -1
    if (b === "EUR") return 1
    return a.localeCompare(b)
  })
  return u
}

function formatRate(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

/** One token: substring match on code. Several tokens (comma/space): exact codes only. */
function filterCurrencyCodes(codes: string[], query: string): string[] {
  const raw = query.trim()
  if (!raw) return codes
  const parts = raw.split(/[\s,]+/).map((p) => p.trim().toUpperCase()).filter(Boolean)
  if (parts.length === 0) return codes
  if (parts.length === 1) {
    const p = parts[0]
    return codes.filter((c) => c.includes(p))
  }
  const want = new Set(parts)
  return codes.filter((c) => want.has(c))
}

export default function ExchangeRatesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [ratesByDate, setRatesByDate] = useState<EurRatesByDocumentDate>({})
  const [dateList, setDateList] = useState<string[]>([])
  const [activeDate, setActiveDate] = useState<string>("")
  const [customYmd, setCustomYmd] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currencyQuery, setCurrencyQuery] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  const loadRecent = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/eur-rates/recent?days=14", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { dates?: string[]; rates?: EurRatesByDocumentDate }
      const dates = data.dates ?? []
      const rates = data.rates ?? {}
      setDateList((prev) => {
        const merged = new Set([...dates, ...prev])
        return [...merged].sort((a, b) => (a > b ? -1 : 1))
      })
      setRatesByDate((prev) => ({ ...prev, ...rates }))
      if (dates.length > 0) {
        setActiveDate((prev) => (prev && rates[prev] ? prev : dates[0]))
      }
    } catch (e) {
      console.error(e)
      setError("Could not load ECB rates. Try again later.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void loadRecent()
  }, [user, loadRecent])

  const loadCustomDate = async () => {
    const d = customYmd.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setError("Use a calendar date in YYYY-MM-DD form.")
      return
    }
    setLoadingCustom(true)
    setError(null)
    try {
      const res = await fetch("/api/eur-rates/by-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [d] }),
        cache: "no-store",
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { rates?: EurRatesByDocumentDate }
      const row = data.rates?.[d]
      if (!row || Object.keys(row).length === 0) {
        setError("No rates returned for that date.")
        return
      }
      setRatesByDate((prev) => ({ ...prev, [d]: row }))
      if (!dateList.includes(d)) {
        setDateList((prev) => [d, ...prev].sort((a, b) => (a > b ? -1 : 1)))
      }
      setActiveDate(d)
    } catch (e) {
      console.error(e)
      setError("Could not load rates for that date.")
    } finally {
      setLoadingCustom(false)
    }
  }

  const activeRates: EurReferenceRates | undefined = activeDate ? ratesByDate[activeDate] : undefined

  const currencies = useMemo(() => {
    if (!activeRates) return []
    return sortCurrencyCodes(Object.keys(activeRates))
  }, [activeRates])

  const filteredCurrencies = useMemo(
    () => filterCurrencyCodes(currencies, currencyQuery),
    [currencies, currencyQuery],
  )

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
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <ArrowLeftRight className="h-8 w-8" aria-hidden />
              Exchange rates
            </h1>
            <p className="mt-1 text-muted-foreground">
              ECB euro reference rates used for invoices, receipts, and costs (units of each currency per 1 EUR).
              Weekends and holidays use the latest prior ECB publication — same rules as when saving documents.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadRecent()}
              disabled={loading}
              title="Reloads the last 14 UTC days from the server (ECB data your app uses). Merges with dates you loaded manually. Keeps your selected date if it is still available."
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
            <p className="max-w-[280px] text-right text-xs text-muted-foreground">
              Reloads last 14 days (merged with any custom dates you loaded). May pick up newer ECB rows if the server refreshes its feed.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pick a date</CardTitle>
            <CardDescription>
              Last 14 days are loaded below. Or enter any past date (rates follow ECB history).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="custom-date">Custom date</Label>
              <Input
                id="custom-date"
                type="date"
                value={customYmd}
                onChange={(e) => setCustomYmd(e.target.value)}
                className="w-full sm:w-[200px]"
              />
            </div>
            <Button type="button" onClick={() => void loadCustomDate()} disabled={loadingCustom || !customYmd}>
              {loadingCustom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Calendar days</CardTitle>
              <CardDescription className="text-xs">Newest first (UTC)</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {loading && dateList.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                dateList.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActiveDate(d)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      activeDate === d
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {d}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rates for {activeDate || "—"}</CardTitle>
              <CardDescription>
                To convert to EUR: divide your amount in foreign currency by the number shown (ECB convention).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeDate || !activeRates ? (
                <p className="text-sm text-muted-foreground">Select a date from the list.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="currency-filter">Filter currencies</Label>
                    <Input
                      id="currency-filter"
                      type="text"
                      placeholder="e.g. USD or DK — or USD, GBP, CZK"
                      value={currencyQuery}
                      onChange={(e) => setCurrencyQuery(e.target.value)}
                      className="max-w-md"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      One term: codes containing that text. Several terms (comma or space): only those exact codes.
                      {currencyQuery.trim()
                        ? ` Showing ${filteredCurrencies.length} of ${currencies.length}.`
                        : null}
                    </p>
                  </div>
                  {filteredCurrencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No currencies match this filter.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Currency</TableHead>
                            <TableHead className="text-right">Units per 1 EUR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCurrencies.map((code) => (
                            <TableRow key={code}>
                              <TableCell className="font-medium">{code}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatRate(activeRates[code] ?? NaN)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Source:{" "}
          <Link href={ECB_INDEX} className="underline underline-offset-4 hover:text-foreground" target="_blank" rel="noreferrer">
            European Central Bank — euro foreign exchange reference rates
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
