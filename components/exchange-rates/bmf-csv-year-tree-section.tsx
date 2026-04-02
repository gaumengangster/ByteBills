"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { User } from "firebase/auth"
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
import { formatInTimeZone } from "date-fns-tz"
import { DOCUMENT_DATE_TIMEZONE } from "@/lib/document-date-berlin"
import { defaultBmfUstCsvUrl } from "@/lib/bmf-ust-rates-csv"
import { persistBmfUstCsvTextToYearMonthTreeClient } from "@/lib/bmf-ust-rates-year-month-client-persist"
import { bmfUstCsvYearDocId, EXCHANGE_RATES_COLLECTION } from "@/lib/exchange-rates-store"
import { ChevronDown, Database, Loader2, RefreshCw } from "lucide-react"

type MonthBundle = {
  monthKey: string
  rates: Record<string, number>
}

function formatRate(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function ratesByMonthFromFirestore(data: Record<string, unknown>): Record<string, Record<string, number>> | null {
  const rb = data.ratesByMonth
  if (rb == null || typeof rb !== "object" || Array.isArray(rb)) return null
  const out: Record<string, Record<string, number>> = {}
  for (const [k, v] of Object.entries(rb as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(k)) continue
    if (v == null || typeof v !== "object" || Array.isArray(v)) continue
    const row: Record<string, number> = {}
    for (const [code, num] of Object.entries(v as Record<string, unknown>)) {
      if (typeof num === "number" && Number.isFinite(num)) {
        row[String(code).toUpperCase()] = num
      }
    }
    if (Object.keys(row).length > 0) out[k] = row
  }
  return Object.keys(out).length > 0 ? out : null
}

type BmfCsvYearTreeSectionProps = {
  user: User
}

export function BmfCsvYearTreeSection({ user }: BmfCsvYearTreeSectionProps) {
  const defaultYear = useMemo(
    () => parseInt(formatInTimeZone(new Date(), DOCUMENT_DATE_TIMEZONE, "yyyy"), 10),
    [],
  )
  const [year, setYear] = useState(defaultYear)
  const [csvUrl, setCsvUrl] = useState(() => defaultBmfUstCsvUrl(defaultYear))
  const [yearMeta, setYearMeta] = useState<{
    createdAt?: string
    updatedAt?: string
    sourceCsvUrl?: string
  } | null>(null)
  const [months, setMonths] = useState<MonthBundle[]>([])
  const [loadingTree, setLoadingTree] = useState(true)
  const [syncPending, setSyncPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Which month panels are expanded (React `<details>` has no `defaultOpen`). */
  const [openMonthKeys, setOpenMonthKeys] = useState<Set<string>>(() => new Set())

  const monthsSignature = useMemo(() => months.map((m) => m.monthKey).join("|"), [months])

  useEffect(() => {
    setCsvUrl(defaultBmfUstCsvUrl(year))
  }, [year])

  useEffect(() => {
    if (months.length === 0) {
      setOpenMonthKeys(new Set())
      return
    }
    setOpenMonthKeys(new Set([months[0].monthKey]))
  }, [monthsSignature])

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    setError(null)
    try {
      const ref = doc(db, EXCHANGE_RATES_COLLECTION, bmfUstCsvYearDocId(user.uid, year))
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        setYearMeta(null)
        setMonths([])
        return
      }
      const d = snap.data() as Record<string, unknown>
      setYearMeta({
        createdAt: typeof d.createdAt === "string" ? d.createdAt : undefined,
        updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : undefined,
        sourceCsvUrl: typeof d.sourceCsvUrl === "string" ? d.sourceCsvUrl : undefined,
      })
      const rb = ratesByMonthFromFirestore(d)
      if (!rb) {
        setMonths([])
        return
      }
      const monthKeys = Object.keys(rb).sort((a, b) => b.localeCompare(a))
      setMonths(monthKeys.map((monthKey) => ({ monthKey, rates: rb[monthKey] })))
    } catch (e) {
      console.error(e)
      setError("Could not load BMF CSV import from Firestore.")
      setYearMeta(null)
      setMonths([])
    } finally {
      setLoadingTree(false)
    }
  }, [user.uid, year])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const onSync = async () => {
    setSyncPending(true)
    setMessage(null)
    setError(null)
    try {
      const token = await user.getIdToken(true)
      const res = await fetch("/api/bmf-ust-rates/fetch-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ year, csvUrl: csvUrl.trim() || undefined }),
        cache: "no-store",
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        csvText?: string
        sourceCsvUrl?: string
        csvBytes?: number
      }
      if (!res.ok) {
        throw new Error(payload.error ?? `Fetch failed (${res.status})`)
      }
      if (typeof payload.csvText !== "string" || !payload.csvText.trim()) {
        throw new Error("Empty CSV response")
      }
      const result = await persistBmfUstCsvTextToYearMonthTreeClient(db, user.uid, {
        year,
        csvText: payload.csvText,
        sourceCsvUrl: typeof payload.sourceCsvUrl === "string" ? payload.sourceCsvUrl : csvUrl.trim(),
        csvBytes: typeof payload.csvBytes === "number" ? payload.csvBytes : payload.csvText.length,
      })
      const mw = result.monthsWritten.length
      setMessage(
        `Saved like an invoice: one document exchange_rates / ${bmfUstCsvYearDocId(user.uid, year)} with ` +
          `${mw} month(s) in ratesByMonth and ${result.currencyRowCount} currency rows (ISO timestamps).`,
      )
      await loadTree()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.")
    } finally {
      setSyncPending(false)
    }
  }

  return (
    <Card className="mb-6 border-primary/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Database className="h-5 w-5 shrink-0" aria-hidden />
          BMF CSV → Firestore (invoice-style)
        </CardTitle>
        <CardDescription>
          CSV text is parsed to <code className="text-xs">ratesByMonth</code> and stored as a single document{" "}
          <code className="text-xs">exchange_rates / {"{userId}"}_bmf_{"{year}"}</code> with{" "}
          <code className="text-xs">userId</code>, <code className="text-xs">createdAt</code> /{" "}
          <code className="text-xs">updatedAt</code> (ISO strings), same idea as <code className="text-xs">invoices</code>.
          Fetch uses <code className="text-xs">/api/bmf-ust-rates/fetch-csv</code> (JWKS token check).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="bmf-csv-year">Year</Label>
            <Input
              id="bmf-csv-year"
              type="number"
              className="w-[120px]"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
            />
          </div>
          <div className="flex-1 min-w-[240px] space-y-1">
            <Label htmlFor="bmf-csv-url">CSV URL</Label>
            <Input
              id="bmf-csv-url"
              type="url"
              className="font-mono text-sm"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="button" onClick={() => void onSync()} disabled={syncPending || loadingTree}>
            {syncPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync from CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadTree()} disabled={loadingTree || syncPending}>
            Reload
          </Button>
        </div>

        {yearMeta?.sourceCsvUrl ? (
          <p className="text-xs text-muted-foreground break-all">
            Source URL: <span className="text-foreground">{yearMeta.sourceCsvUrl}</span>
          </p>
        ) : null}
        {yearMeta?.updatedAt ? (
          <p className="text-xs text-muted-foreground">
            Last updated: <span className="text-foreground">{yearMeta.updatedAt}</span>
            {yearMeta.createdAt ? (
              <>
                {" "}
                · Created: <span className="text-foreground">{yearMeta.createdAt}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        {loadingTree ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : months.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No import for {year} yet. Run <strong>Sync from CSV</strong>.
          </p>
        ) : (
          <div className="space-y-2">
            {months.map(({ monthKey, rates }) => {
              const codes = Object.keys(rates).sort((a, b) => {
                if (a === "EUR") return -1
                if (b === "EUR") return 1
                return a.localeCompare(b)
              })
              const isOpen = openMonthKeys.has(monthKey)
              return (
                <details
                  key={monthKey}
                  className="group rounded-md border bg-card"
                  open={isOpen}
                  onToggle={(e) => {
                    const nextOpen = e.currentTarget.open
                    setOpenMonthKeys((prev) => {
                      const next = new Set(prev)
                      if (nextOpen) next.add(monthKey)
                      else next.delete(monthKey)
                      return next
                    })
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <span>{monthKey}</span>
                    <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      {codes.length} currenc{codes.length === 1 ? "y" : "ies"}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-foreground transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      />
                    </span>
                  </summary>
                  <div className="border-t overflow-x-auto px-0 pb-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Currency</TableHead>
                          <TableHead className="text-right">Units per 1 EUR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {codes.map((code) => (
                          <TableRow key={code}>
                            <TableCell className="font-medium">{code}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatRate(rates[code] ?? NaN)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
