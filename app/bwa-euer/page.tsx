"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, getYear } from "date-fns"
import { de } from "date-fns/locale"
import { Download, Loader2, ScrollText } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth-provider"
import {
  BWA43_DISCLAIMER,
  BWA43_ROWS,
  bwa43Percent,
  type Bwa43Amounts,
  type Bwa43PercentKind,
} from "@/lib/bwa-43-model"
import { bwa43PdfFilename, generateBwa43Pdf } from "@/lib/bwa-43-pdf"
import { bwa43ForMonth, loadBwaEuerPeriod, type BwaEuerYearPayload } from "@/lib/bwa-euer-year-load"
import { getEurReportUi } from "@/lib/translations"

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

function formatPct(p: number | null): string {
  if (p == null) return "—"
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p) + " %"
}

function pctCells(amount: number, kind: Bwa43PercentKind, a: Bwa43Amounts): [string, string, string] {
  const e = bwa43Percent(amount, a.summe_erloese)
  const k = bwa43Percent(amount, a.summe_kosten)
  const b = bwa43Percent(amount, a.betriebseinnahmen)
  if (kind === "erloese") return [formatPct(e), "—", "—"]
  if (kind === "kosten") return [formatPct(e), formatPct(k), "—"]
  if (kind === "betriebseinnahmen") return ["—", "—", formatPct(b)]
  return ["—", "—", "—"]
}

function yearOptions(now: Date): number[] {
  const y = getYear(now)
  return [y, y - 1, y - 2, y - 3, y - 4]
}

export default function BwaEuerPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(() => getYear(now))
  const [month, setMonth] = useState(() => now.getMonth() + 1)
  const [payload, setPayload] = useState<BwaEuerYearPayload | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [exporting, setExporting] = useState(false)
  const eurUi = useMemo(() => getEurReportUi("en"), [])

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingData(true)
    loadBwaEuerPeriod(user.uid, year, month)
      .then((p) => {
        if (!cancelled) setPayload(p)
      })
      .catch((err) => {
        console.error("BWA / EÜR load failed", err)
        if (!cancelled) setPayload(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, year, month])

  const bwa = useMemo(() => (payload ? bwa43ForMonth(payload, month) : null), [payload, month])
  const monthLabel = format(new Date(year, month - 1, 1), "LLLL yyyy", { locale: de })
  const last6Start = new Date(year, month - 6, 1)
  const last6End = new Date(year, month - 1, 1)
  const last6Label =
    last6Start.getFullYear() === last6End.getFullYear()
      ? `${format(last6Start, "LLLL", { locale: de })} - ${format(last6End, "LLLL yyyy", { locale: de })}`
      : `${format(last6Start, "LLLL yyyy", { locale: de })} - ${format(last6End, "LLLL yyyy", { locale: de })}`

  const handleExport = async () => {
    if (!bwa || !payload) return
    setExporting(true)
    try {
      const blob = await generateBwa43Pdf({
        year,
        month,
        monthAmounts: bwa.month,
        last6Amounts: bwa.last6,
        company: payload.company,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = bwa43PdfFilename(year, month)
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("BWA PDF failed", err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">BWA / EÜR</h1>
            <p className="text-muted-foreground">
              Betriebswirtschaftliche Auswertung für EÜR (BWA 43) — letzte 6 Monate, not tax advice.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="bwa-year" className="text-xs text-muted-foreground">
                Year
              </Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger id="bwa-year" className="w-[120px]">
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
              <Label htmlFor="bwa-month" className="text-xs text-muted-foreground">
                Month
              </Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger id="bwa-month" className="w-[160px]">
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
            <Button onClick={handleExport} disabled={!bwa || exporting || loadingData}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download BWA 43
            </Button>
          </div>
        </div>

        {loadingData || !bwa || !payload ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Calculating BWA 43…
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Betriebseinnahmen (letzte 6 Monate)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(bwa.last6.betriebseinnahmen)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Betriebsausgaben (letzte 6 Monate)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(bwa.last6.betriebsausgaben)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Vorläufiges Ergebnis (letzte 6 Monate)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatEurDe(bwa.last6.gewinn)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Tabs defaultValue="bwa">
              <TabsList className="mb-4">
                <TabsTrigger value="bwa">BWA 43</TabsTrigger>
                <TabsTrigger value="euer">EÜR</TabsTrigger>
              </TabsList>

              <TabsContent value="bwa">
                <Card>
                  <CardHeader>
                    <div className="flex items-start gap-2">
                      <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div>
                        <CardTitle>Betriebswirtschaftliche Auswertung für EÜR (BWA 43)</CardTitle>
                        <CardDescription>
                          Kurzfristige Erfolgsrechnung {monthLabel} · letzte 6 Monate ({last6Label}) · {payload.company.name || "ByteBills"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[220px] sticky left-0 bg-background z-10">Bezeichnung</TableHead>
                            <TableHead className="text-right min-w-[110px]">{monthLabel}</TableHead>
                            <TableHead className="text-right min-w-[88px] text-xs">% Ges.-Erlöse</TableHead>
                            <TableHead className="text-right min-w-[88px] text-xs">% Ges.-Kosten</TableHead>
                            <TableHead className="text-right min-w-[96px] text-xs">% Betr.-Einnahm.</TableHead>
                            <TableHead className="text-right min-w-[110px]">{last6Label}</TableHead>
                            <TableHead className="text-right min-w-[88px] text-xs">% Ges.-Erlöse</TableHead>
                            <TableHead className="text-right min-w-[88px] text-xs">% Ges.-Kosten</TableHead>
                            <TableHead className="text-right min-w-[96px] text-xs">% Betr.-Einnahm.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {BWA43_ROWS.map((row, i) => {
                            if (row.kind === "spacer") {
                              return (
                                <TableRow key={`sp-${i}`}>
                                  <TableCell colSpan={9} className="h-3 p-0" />
                                </TableRow>
                              )
                            }
                            if (row.kind === "section") {
                              return (
                                <TableRow key={`sec-${row.label}`} className="bg-muted/50">
                                  <TableCell colSpan={9} className="font-semibold">
                                    {row.label}
                                  </TableCell>
                                </TableRow>
                              )
                            }
                            if (!row.id) return null
                            const mAmt = bwa.month[row.id]
                            const yAmt = bwa.last6[row.id]
                            const mPct = pctCells(mAmt, row.percentKind, bwa.month)
                            const yPct = pctCells(yAmt, row.percentKind, bwa.last6)
                            const strong = row.kind === "total"
                            return (
                              <TableRow key={row.id} className={strong ? "bg-muted/30" : undefined}>
                                <TableCell className={`sticky left-0 bg-background z-10 ${strong ? "font-semibold" : ""}`}>
                                  {row.label}
                                </TableCell>
                                <TableCell className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>
                                  {formatEurDe(mAmt)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{mPct[0]}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{mPct[1]}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{mPct[2]}</TableCell>
                                <TableCell className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>
                                  {formatEurDe(yAmt)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{yPct[0]}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{yPct[1]}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{yPct[2]}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">{BWA43_DISCLAIMER}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="euer">
                <Card>
                  <CardHeader>
                    <CardTitle>{eurUi.cardTitle} {year}</CardTitle>
                    <CardDescription>{eurUi.cardDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{eurUi.colNeed}</TableHead>
                            <TableHead>{eurUi.colAnlage}</TableHead>
                            <TableHead className="text-right">{eurUi.colSum}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">{eurUi.rowIncomeLabel}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{eurUi.rowIncomeAnlage}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.incomeNetEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{eurUi.rowExpenseLabel}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{eurUi.rowExpenseAnlage}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.expenseNetEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{eurUi.rowVatOutLabel}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{eurUi.rowVatOutAnlage}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.outputVatEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{eurUi.rowVatInLabel}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{eurUi.rowVatInAnlage}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.inputVatEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Rent / home office</TableCell>
                            <TableCell className="text-muted-foreground text-sm">EÜR Z.52</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.z52_homeoffice_mieteEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Pauschale (flat rates)</TableCell>
                            <TableCell className="text-muted-foreground text-sm">EÜR Z.53</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.z53_pauschalenEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Commuting (Pendler)</TableCell>
                            <TableCell className="text-muted-foreground text-sm">EÜR Z.54</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.z54_fahrtenEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Depreciation (AfA)</TableCell>
                            <TableCell className="text-muted-foreground text-sm">EÜR Z.44 / Z.45</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.z44_abschreibungenEur)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Other expenses (tagged)</TableCell>
                            <TableCell className="text-muted-foreground text-sm">EÜR Z.59</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEurDe(payload.euer.z59_sonstigesEur)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {eurUi.footerDeadline
                        .replace("{calendarYear}", String(year))
                        .replace("{filingDeadlineYear}", String(year + 1))}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </>
  )
}
