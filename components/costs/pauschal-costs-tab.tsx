"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import {
  HOME_OFFICE_MAX_DAYS_ANNUAL,
  HOME_OFFICE_MAX_EUR_ANNUAL,
  PAUSCHAL_PRESETS,
  pauschalPreviewWarnings,
  roundMoneyEur,
  type PauschalCategory,
  type PauschalCostDoc,
  type PauschalInternalProofType,
  type PauschalPeriod,
} from "@/lib/pauschal-cost-types"
import { buildPauschalCommonFields, yearQuarterFromYmd } from "@/lib/cost-common-fields"
import { CostReportingBadge, FieldHint } from "@/components/costs/cost-reporting-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Calculator, Car, Home, Loader2, Plus, Trash2, Utensils, Wifi } from "lucide-react"

const CATEGORY_LABEL: Record<PauschalCategory, string> = {
  homeoffice: "Home office",
  pendler: "Mileage (Pendler)",
  verpflegung: "Travel meal allowance",
  internet_pauschale: "Internet / phone (internal rule)",
}

const CATEGORY_BLURB: Record<PauschalCategory, string> = {
  homeoffice: "Eligible days × daily rate (no receipt).",
  pendler: "Kilometres × km rate for a route and date range.",
  verpflegung: "Absence days × daily rate; trip details for your records.",
  internet_pauschale: "Months × your agreed monthly amount (internal rule).",
}

const INTERNAL_PROOF_LABEL: Record<PauschalInternalProofType, string> = {
  none: "No extra proof type",
  route_log: "Route / distance log",
  travel_note: "Travel note",
  calendar_note: "Calendar note",
  distance_log: "Distance log",
  home_office_log: "Home office day log",
}

type WizardStep = "pick" | "inputs" | "preview" | "proof"

type Props = { userId: string }

export function PauschalCostsTab({ userId }: Props) {
  const [rows, setRows] = useState<Array<{ id: string; data: Record<string, unknown> }>>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>("pick")
  const [category, setCategory] = useState<PauschalCategory | null>(null)

  const [eligibleDays, setEligibleDays] = useState("1")
  const [dayRate, setDayRate] = useState(String(PAUSCHAL_PRESETS.homeoffice.rate))

  const [kilometers, setKilometers] = useState("1")
  const [kmRate, setKmRate] = useState(String(PAUSCHAL_PRESETS.pendler.rate))
  const [routeDescription, setRouteDescription] = useState("")

  const [absenceDays, setAbsenceDays] = useState("1")
  const [mealDayRate, setMealDayRate] = useState(String(PAUSCHAL_PRESETS.verpflegung.rate))
  const [tripDate, setTripDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [destination, setDestination] = useState("")
  const [tripDurationHours, setTripDurationHours] = useState("")

  const [internetMonths, setInternetMonths] = useState("12")
  const [monthlyInternetEur, setMonthlyInternetEur] = useState("")

  const [period, setPeriod] = useState<PauschalPeriod>("year")
  const [fromDate, setFromDate] = useState(`${format(new Date(), "yyyy")}-01-01`)
  const [toDate, setToDate] = useState(`${format(new Date(), "yyyy")}-12-31`)

  const [previewRateOverride, setPreviewRateOverride] = useState<"" | string>("")

  const [notes, setNotes] = useState("")
  const [businessPurpose, setBusinessPurpose] = useState("")
  const [routeLogOrTravelNote, setRouteLogOrTravelNote] = useState("")
  const [internalProofType, setInternalProofType] = useState<PauschalInternalProofType>("none")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, "pauschalCosts"), where("userId", "==", userId), limit(500))
      const snap = await getDocs(q)
      const list = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      list.sort((a, b) => {
        const ca = String(a.data.createdAt ?? "")
        const cb = String(b.data.createdAt ?? "")
        return cb.localeCompare(ca)
      })
      setRows(list)
    } catch (e) {
      console.error(e)
      toast({
        title: "Could not load Pauschal costs",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const computed = useMemo(() => {
    if (!category) return { rate: 0, quantity: 0, amountEur: 0, unit: PAUSCHAL_PRESETS.homeoffice.unit }
    const preset = PAUSCHAL_PRESETS[category]
    if (category === "homeoffice") {
      const r = Number.parseFloat(String(dayRate).replace(",", "."))
      const q = Number.parseFloat(String(eligibleDays).replace(",", "."))
      if (!Number.isFinite(r) || !Number.isFinite(q)) return { rate: 0, quantity: 0, amountEur: 0, unit: preset.unit }
      return {
        rate: r,
        quantity: q,
        amountEur: roundMoneyEur(r * q),
        unit: preset.unit,
      }
    }
    if (category === "pendler") {
      const r = Number.parseFloat(String(kmRate).replace(",", "."))
      const q = Number.parseFloat(String(kilometers).replace(",", "."))
      if (!Number.isFinite(r) || !Number.isFinite(q)) return { rate: 0, quantity: 0, amountEur: 0, unit: preset.unit }
      return {
        rate: r,
        quantity: q,
        amountEur: roundMoneyEur(r * q),
        unit: preset.unit,
      }
    }
    if (category === "verpflegung") {
      const r = Number.parseFloat(String(mealDayRate).replace(",", "."))
      const q = Number.parseFloat(String(absenceDays).replace(",", "."))
      if (!Number.isFinite(r) || !Number.isFinite(q)) return { rate: 0, quantity: 0, amountEur: 0, unit: preset.unit }
      return {
        rate: r,
        quantity: q,
        amountEur: roundMoneyEur(r * q),
        unit: preset.unit,
      }
    }
    const r = Number.parseFloat(String(monthlyInternetEur).replace(",", "."))
    const q = Number.parseFloat(String(internetMonths).replace(",", "."))
    if (!Number.isFinite(r) || !Number.isFinite(q)) return { rate: 0, quantity: 0, amountEur: 0, unit: preset.unit }
    return {
      rate: r,
      quantity: q,
      amountEur: roundMoneyEur(r * q),
      unit: preset.unit,
    }
  }, [
    category,
    dayRate,
    eligibleDays,
    kmRate,
    kilometers,
    mealDayRate,
    absenceDays,
    monthlyInternetEur,
    internetMonths,
  ])

  const warnings = useMemo(() => {
    if (!category) return []
    if (previewRateOverride.trim() !== "") {
      const r = Number.parseFloat(previewRateOverride.replace(",", "."))
      if (!Number.isFinite(r)) return []
      const q = computed.quantity
      return pauschalPreviewWarnings(category, { quantity: q, rate: r, amountEur: roundMoneyEur(r * q) })
    }
    return pauschalPreviewWarnings(category, {
      quantity: computed.quantity,
      rate: computed.rate,
      amountEur: computed.amountEur,
    })
  }, [category, computed, previewRateOverride])

  const finalRate = useMemo(() => {
    if (previewRateOverride.trim() !== "") {
      const r = Number.parseFloat(previewRateOverride.replace(",", "."))
      return Number.isFinite(r) ? r : computed.rate
    }
    return computed.rate
  }, [previewRateOverride, computed])

  const finalAmount = useMemo(() => {
    const r = finalRate
    const q = computed.quantity
    if (!Number.isFinite(r) || !Number.isFinite(q)) return 0
    return roundMoneyEur(r * q)
  }, [finalRate, computed.quantity])

  const resetWizard = () => {
    setWizardStep("pick")
    setCategory(null)
    setEligibleDays("1")
    setDayRate(String(PAUSCHAL_PRESETS.homeoffice.rate))
    setKilometers("1")
    setKmRate(String(PAUSCHAL_PRESETS.pendler.rate))
    setRouteDescription("")
    setAbsenceDays("1")
    setMealDayRate(String(PAUSCHAL_PRESETS.verpflegung.rate))
    setTripDate(format(new Date(), "yyyy-MM-dd"))
    setDestination("")
    setTripDurationHours("")
    setInternetMonths("12")
    setMonthlyInternetEur("")
    setPeriod("year")
    const y = format(new Date(), "yyyy")
    setFromDate(`${y}-01-01`)
    setToDate(`${y}-12-31`)
    setPreviewRateOverride("")
    setNotes("")
    setBusinessPurpose("")
    setRouteLogOrTravelNote("")
    setInternalProofType("none")
  }

  const openNew = () => {
    resetWizard()
    setDialogOpen(true)
  }

  const goNext = () => {
    if (wizardStep === "pick") {
      if (!category) {
        toast({ title: "Choose a Pauschale", description: "Select one category to continue.", variant: "destructive" })
        return
      }
      setWizardStep("inputs")
      return
    }
    if (wizardStep === "inputs") {
      if (!validateInputs()) return
      setWizardStep("preview")
      setPreviewRateOverride("")
      return
    }
    if (wizardStep === "preview") {
      setWizardStep("proof")
    }
  }

  const goBack = () => {
    if (wizardStep === "inputs") setWizardStep("pick")
    else if (wizardStep === "preview") setWizardStep("inputs")
    else if (wizardStep === "proof") setWizardStep("preview")
  }

  function validateInputs(): boolean {
    if (!category) return false
    const c = computed
    if (c.quantity <= 0 || !Number.isFinite(c.quantity)) {
      toast({ title: "Check inputs", description: "Quantity must be greater than zero.", variant: "destructive" })
      return false
    }
    if (category === "internet_pauschale") {
      const m = Number.parseFloat(monthlyInternetEur.replace(",", "."))
      if (!Number.isFinite(m) || m <= 0) {
        toast({
          title: "Monthly amount",
          description: "Enter a positive monthly EUR amount for your internal rule.",
          variant: "destructive",
        })
        return false
      }
    }
    if (category === "pendler" && routeDescription.trim().length === 0) {
      toast({
        title: "Route",
        description: "Describe the route (e.g. home – client) for your records.",
        variant: "destructive",
      })
      return false
    }
    if (category === "verpflegung" && destination.trim().length === 0) {
      toast({
        title: "Destination",
        description: "Enter a destination for this trip allowance.",
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const save = async () => {
    if (!category) return
    setSaving(true)
    try {
      const r = finalRate
      const q = computed.quantity
      if (!Number.isFinite(r) || !Number.isFinite(q) || q <= 0) {
        throw new Error("Set a valid rate and quantity.")
      }
      if (category === "internet_pauschale" && r <= 0) {
        throw new Error("Enter a positive monthly amount.")
      }
      const preset = PAUSCHAL_PRESETS[category]
      const amountEur = roundMoneyEur(r * q)

      const common = buildPauschalCommonFields({
        category,
        fromDate: fromDate.slice(0, 10),
        amountEur,
        businessPurpose: businessPurpose.trim() || null,
        notes: notes.trim() || null,
      })

      const docData: PauschalCostDoc = {
        userId,
        category,
        businessPurpose: businessPurpose.trim() || undefined,
        legalBasis: preset.legalBasis,
        rate: r,
        unit: preset.unit,
        quantity: q,
        amountEur,
        period,
        fromDate: fromDate.slice(0, 10),
        toDate: toDate.slice(0, 10),
        notes: notes.trim(),
        eurZeile: preset.eurZeile,
        proofType: "pauschale",
        createdAt: new Date().toISOString(),
        noVat: true,
        yearEndEurOnly: true,
        routeDescription: category === "pendler" ? routeDescription.trim() || null : null,
        tripDate: category === "verpflegung" ? tripDate.slice(0, 10) : null,
        tripDurationHours: (() => {
          if (category !== "verpflegung" || tripDurationHours.trim() === "") return null
          const h = Number.parseFloat(tripDurationHours.replace(",", "."))
          return Number.isFinite(h) ? h : null
        })(),
        destination: category === "verpflegung" ? destination.trim() || null : null,
        routeLogOrTravelNote: routeLogOrTravelNote.trim() || null,
        internalProofType,
      }
      await addDoc(collection(db, "pauschalCosts"), {
        ...(docData as unknown as Record<string, unknown>),
        ...common,
      })
      toast({ title: "Saved", description: "Pauschal cost recorded (year-end EÜR only, no VAT)." })
      setDialogOpen(false)
      resetWizard()
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "pauschalCosts", id))
      toast({ title: "Deleted", description: "Pauschal entry removed." })
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const stepIndex = wizardStep === "pick" ? 1 : wizardStep === "inputs" ? 2 : wizardStep === "preview" ? 3 : 4

  const categoryIcon = (cat: PauschalCategory) => {
    if (cat === "homeoffice") return Home
    if (cat === "pendler") return Car
    if (cat === "verpflegung") return Utensils
    return Wifi
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Calculator className="h-5 w-5" />
            Pauschale
            <CostReportingBadge kind="year_end" />
          </CardTitle>
          <CardDescription>
            Rule-based flat amounts (no VAT). Use like a calculator: choose category, enter rule inputs, preview, add
            notes, then save. Counts toward year-end EÜR helpers only.
          </CardDescription>
          <FieldHint className="mt-2">
            No VAT — year-end only. Pauschalen are flat rates with no invoice upload; they do not go on your quarterly VAT
            return.
          </FieldHint>
        </div>
        <Button type="button" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pauschale
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No Pauschal entries yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount (EUR)</TableHead>
                  <TableHead>EÜR</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, data }) => {
                  const cat = data.category as PauschalCategory | undefined
                  const label = cat ? CATEGORY_LABEL[cat] ?? cat : "—"
                  const amt = typeof data.amountEur === "number" ? data.amountEur : 0
                  const fd = String(data.fromDate ?? "")
                  const td = String(data.toDate ?? "")
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {fd} → {td}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{amt.toLocaleString()} €</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {String(data.eurZeile ?? "—")}
                        {data.yearEndEurOnly === true ? (
                          <span className="ml-1 text-xs text-muted-foreground">(year-end)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void remove(id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o)
            if (!o) resetWizard()
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>New Pauschale</DialogTitle>
                <CostReportingBadge kind="year_end" />
              </div>
              <p className="text-sm text-muted-foreground">
                Step {stepIndex} of 4 · No VAT · Year-end EÜR only
              </p>
            </DialogHeader>

            {wizardStep === "pick" && (
              <div className="grid gap-3 sm:grid-cols-2 py-2">
                {(Object.keys(CATEGORY_LABEL) as PauschalCategory[]).map((cat) => {
                  const Icon = categoryIcon(cat)
                  const selected = category === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
                        selected && "ring-2 ring-primary border-primary bg-muted/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{CATEGORY_LABEL[cat]}</div>
                          <p className="text-xs text-muted-foreground mt-1">{CATEGORY_BLURB[cat]}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {wizardStep === "inputs" && category && (
              <div className="grid gap-4 py-2">
                <p className="text-sm text-muted-foreground">{PAUSCHAL_PRESETS[category].legalBasis}</p>

                {category === "homeoffice" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="eligible-days">Eligible days in the period</Label>
                      <Input
                        id="eligible-days"
                        inputMode="numeric"
                        value={eligibleDays}
                        onChange={(e) => setEligibleDays(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Typical cap {HOME_OFFICE_MAX_DAYS_ANNUAL} days per year (€{HOME_OFFICE_MAX_EUR_ANNUAL}{" "}
                        at €{PAUSCHAL_PRESETS.homeoffice.rate}/day).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="day-rate">Daily rate (EUR)</Label>
                      <Input
                        id="day-rate"
                        inputMode="decimal"
                        value={dayRate}
                        onChange={(e) => setDayRate(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {category === "pendler" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="km">Distance (km)</Label>
                      <Input
                        id="km"
                        inputMode="decimal"
                        value={kilometers}
                        onChange={(e) => setKilometers(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="km-rate">Rate per km (EUR)</Label>
                      <Input
                        id="km-rate"
                        inputMode="decimal"
                        value={kmRate}
                        onChange={(e) => setKmRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="route">Route (e.g. home – client)</Label>
                      <Input
                        id="route"
                        value={routeDescription}
                        onChange={(e) => setRouteDescription(e.target.value)}
                        placeholder="Short description"
                      />
                    </div>
                  </>
                )}

                {category === "verpflegung" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="absence-days">Absence days (meal allowance)</Label>
                      <Input
                        id="absence-days"
                        inputMode="decimal"
                        value={absenceDays}
                        onChange={(e) => setAbsenceDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meal-rate">Per-day rate (EUR)</Label>
                      <Input
                        id="meal-rate"
                        inputMode="decimal"
                        value={mealDayRate}
                        onChange={(e) => setMealDayRate(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="trip-date">Trip date</Label>
                        <Input
                          id="trip-date"
                          type="date"
                          value={tripDate}
                          onChange={(e) => setTripDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trip-h">Trip duration (hours, optional)</Label>
                        <Input
                          id="trip-h"
                          inputMode="decimal"
                          value={tripDurationHours}
                          onChange={(e) => setTripDurationHours(e.target.value)}
                          placeholder="e.g. 10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dest">Destination</Label>
                      <Input
                        id="dest"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="City or region"
                      />
                    </div>
                  </>
                )}

                {category === "internet_pauschale" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="mon-eur">Monthly amount (EUR)</Label>
                      <Input
                        id="mon-eur"
                        inputMode="decimal"
                        value={monthlyInternetEur}
                        onChange={(e) => setMonthlyInternetEur(e.target.value)}
                        placeholder="Your internal monthly amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imonths">Months in scope</Label>
                      <Input
                        id="imonths"
                        inputMode="decimal"
                        value={internetMonths}
                        onChange={(e) => setInternetMonths(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Allocation period (for reports)</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as PauschalPeriod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHint>How you slice the rule for your own records; reporting uses the date range below.</FieldHint>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-d">From</Label>
                    <Input id="from-d" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-d">To</Label>
                    <Input id="to-d" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>
                <FieldHint>
                  Year and quarter for shared reporting metadata use the &quot;From&quot; date
                  {(() => {
                    const yq = yearQuarterFromYmd(fromDate)
                    return yq ? ` (${yq.year} · Q${yq.quarter}).` : "."
                  })()}
                </FieldHint>
              </div>
            )}

            {wizardStep === "preview" && category && (
              <div className="grid gap-4 py-2">
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="text-sm font-medium">Calculation</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="tabular-nums text-right">
                      {finalRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} EUR
                      / {PAUSCHAL_PRESETS[category].unit === "day" ? "day" : PAUSCHAL_PRESETS[category].unit === "km" ? "km" : "month"}
                    </span>
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="tabular-nums text-right">{computed.quantity}</span>
                    <span className="text-muted-foreground">Amount</span>
                    <span className="tabular-nums text-right font-semibold">
                      {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-override">Adjust rate (optional)</Label>
                  <Input
                    id="rate-override"
                    inputMode="decimal"
                    placeholder="Leave empty to use values from step 2"
                    value={previewRateOverride}
                    onChange={(e) => setPreviewRateOverride(e.target.value)}
                  />
                </div>
                {warnings.length > 0 && (
                  <Alert>
                    <AlertTitle>Limits & checks</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 space-y-1">
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {wizardStep === "proof" && category && (
              <div className="grid gap-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Internal proof only — no invoice upload. Add what you need for your files.
                </p>
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Summary before save</span>
                    <CostReportingBadge kind="year_end" />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd className="text-right">{CATEGORY_LABEL[category]}</dd>
                    <dt className="text-muted-foreground">Reporting date (from)</dt>
                    <dd className="tabular-nums text-right">{fromDate.slice(0, 10)}</dd>
                    <dt className="text-muted-foreground">Year / quarter</dt>
                    <dd className="tabular-nums text-right">
                      {(() => {
                        const yq = yearQuarterFromYmd(fromDate)
                        return yq ? `${yq.year} · Q${yq.quarter}` : "—"
                      })()}
                    </dd>
                    <dt className="text-muted-foreground">Amount (EUR)</dt>
                    <dd className="tabular-nums text-right font-medium">{finalAmount.toLocaleString()} €</dd>
                  </dl>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-purpose-p">Business purpose (optional)</Label>
                  <Textarea
                    id="biz-purpose-p"
                    value={businessPurpose}
                    onChange={(e) => setBusinessPurpose(e.target.value)}
                    placeholder="Why this Pauschale applies to your business"
                    rows={2}
                  />
                  <FieldHint>Helps explain the entry if your advisor or a tax office asks later.</FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proof-kind">Internal proof type</Label>
                  <Select
                    value={internalProofType}
                    onValueChange={(v) => setInternalProofType(v as PauschalInternalProofType)}
                  >
                    <SelectTrigger id="proof-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(INTERNAL_PROOF_LABEL) as PauschalInternalProofType[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {INTERNAL_PROOF_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="route-note">Route log or travel note (optional)</Label>
                  <Textarea
                    id="route-note"
                    value={routeLogOrTravelNote}
                    onChange={(e) => setRouteLogOrTravelNote(e.target.value)}
                    placeholder="e.g. return trip, meeting list, or absence note"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes-p">Notes</Label>
                  <Textarea
                    id="notes-p"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything else for your records"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
              <div className="flex gap-2">
                {wizardStep !== "pick" && (
                  <Button type="button" variant="outline" onClick={goBack}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                {wizardStep !== "proof" && (
                  <Button type="button" onClick={goNext}>
                    Continue
                  </Button>
                )}
                {wizardStep === "proof" && (
                  <Button type="button" onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
