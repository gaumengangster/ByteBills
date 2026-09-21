"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, getYear } from "date-fns"
import { de } from "date-fns/locale"
import { ClipboardList, Loader2 } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth-provider"
import { cn } from "@/lib/utils"
import {
  EKS_A_ROWS,
  EKS_B1_ROWS,
  EKS_B2_ROWS,
  EKS_B3_ROWS,
  EKS_C_ROWS,
  EKS_DISCLAIMER,
  eksYmKey,
  type EksAmounts,
  type EksRowDef,
  type EksYearMonth,
} from "@/lib/eks-model"
import { loadEksPeriod, type EksPeriodPayload } from "@/lib/eks-period-load"

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

function formatEurDe(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function yearOptions(now: Date): number[] {
  const y = getYear(now)
  return [y, y - 1, y - 2, y - 3, y - 4]
}

function monthShort(ym: EksYearMonth): string {
  return format(new Date(ym.year, ym.month - 1, 1), "LLL yyyy", { locale: de })
}

function cellText(amount: number, kind: EksRowDef["kind"]): string {
  if (kind === "leaf" && Math.abs(amount) < 0.005) return ""
  return formatEurDe(amount)
}

function EksGrid({
  title,
  caption,
  rows,
  months,
  byMonth,
  summe,
}: {
  title: string
  caption?: string
  rows: EksRowDef[]
  months: EksYearMonth[]
  byMonth: Record<string, EksAmounts>
  summe: EksAmounts
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {caption ? <CardDescription>{caption}</CardDescription> : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[16rem] sticky left-0 bg-background z-10">
                Kalendermonat
              </TableHead>
              {months.map((ym) => (
                <TableHead key={eksYmKey(ym)} className="text-right whitespace-nowrap min-w-[7.5rem]">
                  {monthShort(ym)}
                </TableHead>
              ))}
              <TableHead className="text-right whitespace-nowrap min-w-[7.5rem]">Summe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const strong = row.kind !== "leaf"
              return (
                <TableRow key={row.id} className={cn(strong && "bg-muted/40 font-medium")}>
                  <TableCell className={cn("sticky left-0 z-10 text-sm", strong ? "bg-muted/40" : "bg-background")}>
                    {row.label}
                  </TableCell>
                  {months.map((ym) => {
                    const amounts = byMonth[eksYmKey(ym)]
                    const n = amounts ? amounts[row.id] : 0
                    const prefix = row.id === "b6_priv_km" && Math.abs(n) >= 0.005 ? "− " : ""
                    return (
                      <TableCell key={eksYmKey(ym)} className="text-right tabular-nums text-sm">
                        {prefix}
                        {cellText(n, row.kind)}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {row.id === "b6_priv_km" && Math.abs(summe[row.id]) >= 0.005 ? "− " : ""}
                    {cellText(summe[row.id], row.kind)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function EksPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(() => getYear(now))
  const [month, setMonth] = useState(() => now.getMonth() + 1)
  const [declaration, setDeclaration] = useState<"vorlaeufig" | "abschließend">("vorlaeufig")
  const [payload, setPayload] = useState<EksPeriodPayload | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingData(true)
    loadEksPeriod(user.uid, year, month)
      .then((p) => {
        if (!cancelled) setPayload(p)
      })
      .catch((err) => {
        console.error("EKS load failed", err)
        if (!cancelled) setPayload(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, year, month])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-7 w-7" />
              EKS
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Jobcenter-EKS — last six calendar months, cash basis (payment date). Not tax advice.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="eks-year" className="text-xs text-muted-foreground">
                End year
              </Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger id="eks-year" className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions(now).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="eks-month" className="text-xs text-muted-foreground">
                End month
              </Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger id="eks-month" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_DE.map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eks-declaration"
              checked={declaration === "vorlaeufig"}
              onChange={() => setDeclaration("vorlaeufig")}
            />
            vorläufige Erklärung
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eks-declaration"
              checked={declaration === "abschließend"}
              onChange={() => setDeclaration("abschließend")}
            />
            abschließende Erklärung
          </label>
        </div>

        {loadingData || !payload ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Calculating EKS…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Summe Betriebseinnahmen</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(payload.summe.a_sum)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Summe Betriebsausgaben</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(payload.summe.b_sum)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gewinn</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(payload.summe.gewinn)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              Amounts use <strong>payment date</strong>, not invoice Leistungsdatum or expense date. Unpaid items
              (no payment date) are omitted.
            </p>

            <EksGrid
              title="43 Tabelle A: Angaben zu den Betriebseinnahmen"
              rows={EKS_A_ROWS}
              months={payload.months}
              byMonth={payload.byMonth}
              summe={payload.summe}
            />
            <EksGrid
              title="45 Tabelle B – Teil 1: Angaben zu den Betriebsausgaben"
              rows={EKS_B1_ROWS}
              months={payload.months}
              byMonth={payload.byMonth}
              summe={payload.summe}
            />
            <EksGrid
              title="48 Tabelle B – Teil 2: Angaben zu den Betriebsausgaben"
              rows={EKS_B2_ROWS}
              months={payload.months}
              byMonth={payload.byMonth}
              summe={payload.summe}
            />
            <EksGrid
              title="49 Tabelle B – Teil 3: Angaben zu den Betriebsausgaben und zum Gewinn"
              rows={EKS_B3_ROWS}
              months={payload.months}
              byMonth={payload.byMonth}
              summe={payload.summe}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">51 Tabelle C: Absetzungen vom Einkommen</CardTitle>
                <CardDescription>Period total by payment date ({payload.window.from} – {payload.window.to})</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Art der Absetzung</TableHead>
                      <TableHead className="text-right w-40">Höhe in Euro</TableHead>
                      <TableHead className="w-56">Zahlungsrhythmus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EKS_C_ROWS.map((row) => {
                      const cell = payload.tableC[row.id]
                      const empty = Math.abs(cell.amount) < 0.005
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm">{row.label}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {empty ? "" : formatEurDe(cell.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{empty ? "" : cell.rhythm}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground border-t pt-4">{EKS_DISCLAIMER}</p>
      </main>
    </>
  )
}
