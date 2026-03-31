"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { arrayUnion, deleteField, doc, getDoc, updateDoc } from "firebase/firestore"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { uploadFileToGoogleDrive } from "@/lib/google-drive-upload-client"
import { buildCostAusgabeUploadedFilename } from "@/lib/document-filename"
import { fetchNextCostSequenceNumber } from "@/lib/cost-sequence"
import type { CostItem, CostDocumentType, VatCode, VendorOrigin } from "@/lib/cost-item-types"
import { VAT_CODE_OPTIONS, VENDOR_ORIGIN_OPTIONS } from "@/lib/cost-item-types"
import { vatQuarterMetaFromYmd, euerYearFromYmd } from "@/lib/cost-item-derive"
import type { ExtractedBillData } from "@/lib/bill-types"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const EUER_CATEGORY_OPTIONS = [
  { value: "software", label: "Software" },
  { value: "internet", label: "Internet / telecom" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "travel", label: "Travel" },
  { value: "insurance", label: "Insurance" },
  { value: "bank_fees", label: "Bank fees" },
  { value: "education", label: "Education" },
  { value: "homeoffice_miete", label: "Home office / rent share" },
  { value: "hardware", label: "Hardware / equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "subscriptions", label: "Subscriptions / SaaS" },
  { value: "other", label: "Other" },
]

type Step = "upload" | "details" | "review"

interface PendingFile {
  id: string
  file: File
  docType: CostDocumentType
  preview?: string
}

function parseNum(s: string): number | undefined {
  const n = Number.parseFloat(s.replace(",", ".").trim())
  return Number.isFinite(n) ? n : undefined
}

function fmtDate(ymd: string) {
  try { return format(new Date(ymd), "dd.MM.yyyy") } catch { return ymd }
}

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
])

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", JP: "JPY", CA: "CAD", AU: "AUD",
  NZ: "NZD", SG: "SGD", HK: "HKD", CN: "CNY", IN: "INR", BR: "BRL",
  MX: "MXN", ZA: "ZAR", RU: "RUB", TR: "TRY", RS: "RSD", UA: "UAH",
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US", USA: "US",
  "U.S.": "US", "U.S.A.": "US", AMERICA: "US",
  "UNITED KINGDOM": "GB", UK: "GB", "GREAT BRITAIN": "GB", ENGLAND: "GB",
  GERMANY: "DE", DEUTSCHLAND: "DE", AUSTRIA: "AT",
  SWITZERLAND: "CH", SCHWEIZ: "CH", FRANCE: "FR", ITALY: "IT",
  SPAIN: "ES", NETHERLANDS: "NL", AUSTRALIA: "AU", CANADA: "CA",
  JAPAN: "JP", CHINA: "CN", INDIA: "IN", SINGAPORE: "SG",
  "HONG KONG": "HK", "SOUTH KOREA": "KR", KOREA: "KR",
  BRAZIL: "BR", MEXICO: "MX", RUSSIA: "RU", TURKEY: "TR",
  SERBIA: "RS", UKRAINE: "UA", SWEDEN: "SE", NORWAY: "NO",
  DENMARK: "DK", FINLAND: "FI", POLAND: "PL",
  "CZECH REPUBLIC": "CZ", CZECHIA: "CZ", HUNGARY: "HU", "NEW ZEALAND": "NZ",
}

function normalizeCountryCode(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw.trim()) return ""
  const upper = raw.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  const fromName = COUNTRY_NAME_TO_ISO[upper]
  if (fromName) return fromName
  if (/^[A-Z]{3}$/.test(upper) && COUNTRY_DEFAULT_CURRENCY[upper.slice(0, 2)]) return upper.slice(0, 2)
  return ""
}

const CURRENCY_TOKEN_MAP: Record<string, string> = {
  EUR: "EUR",
  EURO: "EUR",
  "€": "EUR",
  USD: "USD",
  US$: "USD",
  "$": "USD",
  GBP: "GBP",
  "£": "GBP",
  CHF: "CHF",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  PLN: "PLN",
  CZK: "CZK",
  HUF: "HUF",
  JPY: "JPY",
  "¥": "JPY",
  CAD: "CAD",
  "C$": "CAD",
  AUD: "AUD",
  "A$": "AUD",
  NZD: "NZD",
  "NZ$": "NZD",
  SGD: "SGD",
  "S$": "SGD",
  HKD: "HKD",
  "HK$": "HKD",
  CNY: "CNY",
  RMB: "CNY",
  INR: "INR",
  "₹": "INR",
}

const CURRENCY_MARKERS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹",
}

function resolveCurrency(extractedCurrency: string | null | undefined, countryCode: string | null | undefined): string {
  const token = typeof extractedCurrency === "string" ? extractedCurrency.trim().toUpperCase() : ""
  const direct = token ? (CURRENCY_TOKEN_MAP[token] ?? (/^[A-Z]{3}$/.test(token) ? token : null)) : null

  if (direct) return direct

  const cc = normalizeCountryCode(countryCode)
  if (cc && !EU_COUNTRY_CODES.has(cc)) return COUNTRY_DEFAULT_CURRENCY[cc] ?? "EUR"
  return "EUR"
}

function currencyMarker(currency: string | null | undefined): string {
  const code = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "EUR"
  return CURRENCY_MARKERS[code] ?? code
}

function formatAmountValue(value: string, currency: string): string {
  return value ? `${currencyMarker(currency)} ${value}` : "—"
}

export default function UploadDocumentPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const collectionName = decodeURIComponent(params.collection as string)
  const itemId = params.id as string

  // ── cost item ───────────────────────────────────────────────────────────
  const [costItem, setCostItem] = useState<CostItem | null>(null)
  const [loadingItem, setLoadingItem] = useState(true)

  // ── wizard state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("upload")
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [extractSourceId, setExtractSourceId] = useState<string | null>(null)

  // ── extracted / editable fields ─────────────────────────────────────────
  const [vendor, setVendor] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [net, setNet] = useState("")
  const [vat, setVat] = useState("")
  const [gross, setGross] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [eurRate, setEurRate] = useState<number | null>(null)
  const [eurRateDate, setEurRateDate] = useState<string | null>(null)
  const [category, setCategory] = useState("")
  const [vendorCc, setVendorCc] = useState<string | null>(null)
  const [vatCode, setVatCode] = useState<VatCode | "">("")
  const [vendorOrigin, setVendorOrigin] = useState<VendorOrigin | "">("")
  const [updateAmounts, setUpdateAmounts] = useState(true)

  // ── async state ─────────────────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingEurRate, setFetchingEurRate] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── load cost item ───────────────────────────────────────────────────────
  const loadItem = useCallback(async () => {
    setLoadingItem(true)
    try {
      const snap = await getDoc(doc(db, collectionName, itemId))
      if (!snap.exists()) {
        toast({ title: "Not found", description: "Cost item not found.", variant: "destructive" })
        router.push("/costs")
        return
      }
      const data = snap.data() as CostItem
      setCostItem(data)
      // Pre-fill fields from existing item
      setVendor(data.vendorName ?? "")
      setInvoiceDate(data.expenseDate ?? "")
      setCategory(data.category ?? "other")
      if (data.amountNet) setNet(String(data.amountNet))
      if (data.amountVat) setVat(String(data.amountVat))
      if (data.amountGross) setGross(String(data.amountGross))
      setCurrency(typeof data.currency === "string" && data.currency.trim() ? data.currency.trim().toUpperCase() : "EUR")
      setEurRate(typeof data.eurRate === "number" && Number.isFinite(data.eurRate) ? data.eurRate : null)
      setEurRateDate(typeof data.eurRateDate === "string" && data.eurRateDate.trim() ? data.eurRateDate : null)
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Load failed", variant: "destructive" })
    } finally {
      setLoadingItem(false)
    }
  }, [collectionName, itemId, router])

  useEffect(() => {
    if (!authLoading && !user) { router.push("/auth/login"); return }
    if (!authLoading && user) void loadItem()
  }, [authLoading, user, loadItem, router])

  const fetchEurRate = useCallback(async (date: string, currencyCode: string) => {
    if (!date || currencyCode === "EUR") {
      setEurRate(null)
      setEurRateDate(null)
      return
    }

    setFetchingEurRate(true)
    try {
      const res = await fetch("/api/eur-rates/by-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [date] }),
      })
      const data = (await res.json()) as { rates: Record<string, Record<string, number>> }
      const rate = data.rates?.[date]?.[currencyCode]
      if (rate && Number.isFinite(rate)) {
        setEurRate(rate)
        setEurRateDate(date)
      } else {
        setEurRate(null)
        setEurRateDate(null)
      }
    } catch {
      setEurRate(null)
      setEurRateDate(null)
    } finally {
      setFetchingEurRate(false)
    }
  }, [])

  useEffect(() => {
    if (!invoiceDate || currency === "EUR") {
      if (currency === "EUR") {
        setEurRate(null)
        setEurRateDate(null)
      }
      return
    }
    void fetchEurRate(invoiceDate, currency)
  }, [currency, fetchEurRate, invoiceDate])

  // ── auto-extract when arriving at details step ───────────────────────────
  const hasExtracted = useRef(false)
  useEffect(() => {
    if (step !== "details" || pendingFiles.length === 0 || hasExtracted.current) return
    const srcId = extractSourceId ?? pendingFiles[0].id
    const src = pendingFiles.find((f) => f.id === srcId) ?? pendingFiles[0]
    if (!src) return
    hasExtracted.current = true
    void runExtraction(src.file)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── file selection ───────────────────────────────────────────────────────
  const onFilesSelected = (files: FileList | null) => {
    if (!files) return
    const added: PendingFile[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      docType: f.name.toLowerCase().includes("receipt") ? "receipt" : "invoice",
    }))
    setPendingFiles((prev) => [...prev, ...added])
    if (!extractSourceId && added.length > 0) setExtractSourceId(added[0].id)
  }

  const removeFile = (id: string) => {
    setPendingFiles((prev) => {
      const next = prev.filter((f) => f.id !== id)
      if (extractSourceId === id) setExtractSourceId(next[0]?.id ?? null)
      return next
    })
  }

  // ── OpenAI extraction ────────────────────────────────────────────────────
  const runExtraction = async (file: File) => {
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/costs/extract", { method: "POST", body: fd })
      const json = (await res.json()) as { extracted?: ExtractedBillData; error?: string }
      if (!res.ok || !json.extracted) {
        toast({ title: "Extraction failed", description: json.error ?? "Unknown error", variant: "destructive" })
        return
      }
      const e = json.extracted
      if (e.merchant) setVendor(e.merchant)
      if (e.billDate) setInvoiceDate(e.billDate)
      if (e.invoiceNumber) setInvoiceNo(e.invoiceNumber)
      if (e.subtotal != null) setNet(String(e.subtotal))
      if (e.vatAmount != null) setVat(String(e.vatAmount))
      if (e.total != null) setGross(String(e.total))
      const nextVendorCc = normalizeCountryCode(e.merchantCountryCode) || null
      if (nextVendorCc) setVendorCc(nextVendorCc)
      setCurrency(resolveCurrency(e.currency, nextVendorCc))
      toast({ title: "Data extracted", description: "Review and adjust the values below." })
    } catch (err) {
      toast({ title: "Extraction error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" })
    } finally {
      setExtracting(false)
    }
  }

  const reExtract = () => {
    const src = pendingFiles.find((f) => f.id === extractSourceId) ?? pendingFiles[0]
    if (!src) return
    hasExtracted.current = false
    void runExtraction(src.file)
  }

  // ── save ─────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!costItem) return
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const expDate = invoiceDate || costItem.expenseDate || format(new Date(), "yyyy-MM-dd")
      const baseSeq = await fetchNextCostSequenceNumber(user!.uid)

      // Upload each file to Drive
      const newDocs = []
      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i]
        const seq = String(Number(baseSeq) + i).padStart(3, "0")
        const displayName = buildCostAusgabeUploadedFilename({
          billDate: expDate,
          merchant: vendor.trim() || costItem.vendorName || costItem.title || "cost",
          countryCode: vendorCc,
          kind: pf.docType === "receipt" ? "receipt" : pf.docType === "payment_proof" ? "bank_proof" : "invoice",
          originalFileName: pf.file.name,
          sequenceNumber: seq,
        })
        const { fileId } = await uploadFileToGoogleDrive(pf.file, displayName)
        newDocs.push({
          id: fileId,
          fileId,
          fileName: displayName,
          originalFileName: pf.file.name,
          mimeType: pf.file.type || "application/octet-stream",
          uploadedAt: nowIso,
          docType: pf.docType,
          source: "google_drive",
        })
      }

      // Build update payload
      const update: Record<string, unknown> = {
        documentStatus: "uploaded",
        updatedAt: nowIso,
        documents: arrayUnion(...newDocs),
      }

      if (updateAmounts) {
        const netVal = parseNum(net)
        const vatVal = parseNum(vat)
        const grossVal = parseNum(gross) ?? (netVal != null && vatVal != null ? netVal + vatVal : undefined)
        const currencyCode = currency.trim().toUpperCase() || "EUR"
        if (vendor.trim()) update.vendorName = vendor.trim()
        if (invoiceDate) update.expenseDate = invoiceDate
        if (invoiceNo.trim()) update.invoiceNumber = invoiceNo.trim()
        if (category) update.category = category
        if (vatCode) update.vatCode = vatCode
        if (vendorOrigin) update.vendorOrigin = vendorOrigin
        update.currency = currencyCode

        // Keep euerYear / vatYear / vatQuarter in sync with the (possibly updated) expense date
        const dateFinal = invoiceDate || expDate
        const computedEuerYear = euerYearFromYmd(dateFinal)
        update.euerYear = computedEuerYear
        if (costItem?.includeInVatQuarter) {
          const qm = vatQuarterMetaFromYmd(dateFinal)
          update.vatYear    = qm?.vatYear    ?? null
          update.vatQuarter = qm?.vatQuarter ?? null
        } else {
          // Non-VAT items: keep vatYear aligned with euerYear; clear any stale vatQuarter
          update.vatYear    = computedEuerYear
          update.vatQuarter = deleteField()
        }
        if (netVal != null) update.amountNet = netVal
        if (vatVal != null) update.amountVat = vatVal
        if (grossVal != null) update.amountGross = grossVal
        if (currencyCode === "EUR") {
          update.originalCurrency = deleteField()
          update.amountNetEur = deleteField()
          update.amountVatEur = deleteField()
          update.amountGrossEur = deleteField()
          update.eurRate = deleteField()
          update.eurRateDate = deleteField()
        } else {
          update.originalCurrency = currencyCode
          update.amountNetEur = netVal != null && eurRate ? Math.round((netVal / eurRate) * 100) / 100 : deleteField()
          update.amountVatEur = vatVal != null && eurRate ? Math.round((vatVal / eurRate) * 100) / 100 : deleteField()
          update.amountGrossEur = grossVal != null && eurRate ? Math.round((grossVal / eurRate) * 100) / 100 : deleteField()
          update.eurRate = eurRate ?? deleteField()
          update.eurRateDate = eurRate ? ((eurRateDate ?? invoiceDate) || expDate) : deleteField()
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDoc(doc(db, collectionName, itemId), update as any)
      toast({ title: "Saved", description: `${newDocs.length} file${newDocs.length > 1 ? "s" : ""} uploaded and document status updated.` })
      router.push("/costs")
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ── loading ──────────────────────────────────────────────────────────────
  if (authLoading || loadingItem) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!costItem) return null

  // ── step indicators ───────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload files" },
    { key: "details", label: "Extract & edit" },
    { key: "review", label: "Review & save" },
  ]
  const stepIdx = steps.findIndex((s) => s.key === step)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/costs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Upload document</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {costItem.title}
              {costItem.expenseDate ? ` · ${fmtDate(costItem.expenseDate)}` : ""}
              {" "}
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-destructive text-destructive-foreground border-destructive">
                Document needed
              </span>
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border",
                i < stepIdx ? "bg-primary text-primary-foreground border-primary" :
                i === stepIdx ? "bg-primary/10 text-primary border-primary" :
                "bg-muted text-muted-foreground border-border",
              )}>
                {i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("text-sm", i === stepIdx ? "font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="h-px w-8 bg-border mx-1" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload invoice &amp; receipt</CardTitle>
              <CardDescription>
                Upload one or more files. You can attach the original invoice, a payment receipt, or both.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => onFilesSelected(e.target.files)}
              />

              {pendingFiles.length === 0 ? (
                <div
                  className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">Click to choose files</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, PNG, JPG — up to multiple files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingFiles.map((pf) => (
                    <div key={pf.id} className="flex items-center gap-2 rounded-md border p-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{pf.file.name}</span>
                      <Select
                        value={pf.docType}
                        onValueChange={(v) =>
                          setPendingFiles((rows) =>
                            rows.map((r) => r.id === pf.id ? { ...r, docType: v as CostDocumentType } : r)
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="receipt">Receipt</SelectItem>
                          <SelectItem value="payment_proof">Payment proof</SelectItem>
                          <SelectItem value="bank_statement">Bank statement</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeFile(pf.id)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Add more files
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  disabled={pendingFiles.length === 0}
                  onClick={() => setStep("details")}
                >
                  Next: Extract details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Extract & edit ────────────────────────────────────── */}
        {step === "details" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Extract &amp; edit details
              </CardTitle>
              <CardDescription>
                AI will extract data from your document. Review and correct if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* File selector for extraction */}
              {pendingFiles.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Extract data from</Label>
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((pf) => (
                      <button
                        key={pf.id}
                        type="button"
                        onClick={() => setExtractSourceId(pf.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                          extractSourceId === pf.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <FileText className="h-3 w-3" />
                        {pf.file.name.slice(0, 24)}{pf.file.name.length > 24 ? "…" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Extract status / re-trigger */}
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="text-sm">Extracting with AI…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground flex-1">Fields filled from document — adjust below</span>
                    <Button type="button" variant="outline" size="sm" onClick={reExtract}>
                      Re-extract
                    </Button>
                  </>
                )}
              </div>

              <Separator />

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="vendor">Vendor / merchant</Label>
                  <Input
                    id="vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. AWS, Telekom, Ikea"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-date">Invoice date</Label>
                  <Input
                    id="inv-date"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-no">Invoice number</Label>
                  <Input
                    id="inv-no"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vendor-origin">Vendor origin</Label>
                  <Select value={vendorOrigin} onValueChange={(v) => setVendorOrigin(v as VendorOrigin)}>
                    <SelectTrigger id="vendor-origin">
                      <SelectValue placeholder="Select origin…" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_ORIGIN_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vat-code">VAT rate</Label>
                  <Select
                    value={vatCode}
                    onValueChange={(v) => {
                      const code = v as VatCode
                      setVatCode(code)
                      const opt = VAT_CODE_OPTIONS.find((o) => o.value === code)
                      const n = parseNum(net)
                      if (opt && n != null) {
                        const vatAmt = Math.round(n * opt.rate * 100) / 100
                        setVat(String(vatAmt))
                        setGross(String(Math.round((n + vatAmt) * 100) / 100))
                      }
                    }}
                  >
                    <SelectTrigger id="vat-code">
                      <SelectValue placeholder="Select VAT rate…" />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_CODE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="net">Net ({currencyMarker(currency)})</Label>
                  <Input
                    id="net"
                    value={net}
                    onChange={(e) => setNet(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    onBlur={() => {
                      const opt = VAT_CODE_OPTIONS.find((o) => o.value === vatCode)
                      const n = parseNum(net)
                      if (opt && n != null) {
                        const vatAmt = Math.round(n * opt.rate * 100) / 100
                        if (!vat) setVat(String(vatAmt))
                        if (!gross) setGross(String(Math.round((n + vatAmt) * 100) / 100))
                      } else {
                        const n2 = parseNum(net)
                        const v = parseNum(vat)
                        if (n2 != null && v != null && !gross) setGross(String((n2 + v).toFixed(2)))
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vat">VAT ({currencyMarker(currency)})</Label>
                  <Input
                    id="vat"
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gross">Gross ({currencyMarker(currency)})</Label>
                  <Input
                    id="gross"
                    value={gross}
                    onChange={(e) => setGross(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {currency !== "EUR" && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {fetchingEurRate ? (
                    <span className="text-muted-foreground">Fetching ECB rate for {currency}…</span>
                  ) : eurRate ? (
                    <span className="text-muted-foreground">
                      ECB rate on {eurRateDate}: 1 EUR = {eurRate.toFixed(4)} {currency}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Currency detected as {currency}, but no ECB rate is available for {invoiceDate || "this date"}.
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="category">EÜR category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EUER_CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="update-amounts"
                  checked={updateAmounts}
                  onChange={(e) => setUpdateAmounts(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="update-amounts" className="text-sm font-normal cursor-pointer">
                  Update the cost item with these amounts
                </Label>
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setStep("review")}>
                  Next: Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Review & save ─────────────────────────────────────── */}
        {step === "review" && (
          <Card>
            <CardHeader>
              <CardTitle>Review &amp; save</CardTitle>
              <CardDescription>Confirm everything looks correct before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Files */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files to upload</p>
                {pendingFiles.map((pf) => (
                  <div key={pf.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{pf.file.name}</span>
                    <Badge variant="outline" className="text-[10px]">{pf.docType}</Badge>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Amounts summary */}
              <div className="space-y-1.5 text-sm">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</p>
                <div className="rounded-md border divide-y">
                  {[
                    { label: "Vendor", value: vendor || "—" },
                    { label: "Date", value: invoiceDate ? fmtDate(invoiceDate) : "—" },
                    { label: "Invoice no.", value: invoiceNo || "—" },
                    { label: "Currency", value: currency || "EUR" },
                    { label: "Net", value: formatAmountValue(net, currency) },
                    { label: "Vendor origin", value: VENDOR_ORIGIN_OPTIONS.find((o) => o.value === vendorOrigin)?.label ?? (vendorOrigin || "—") },
                    { label: "VAT rate", value: VAT_CODE_OPTIONS.find((o) => o.value === vatCode)?.label ?? (vatCode || "—") },
                    { label: "VAT", value: formatAmountValue(vat, currency) },
                    { label: "Gross", value: formatAmountValue(gross, currency) },
                    { label: "Category", value: (EUER_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category) || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                {!updateAmounts && (
                  <p className="text-xs text-muted-foreground italic">
                    Amounts will NOT be updated on the cost item (checkbox unchecked on previous step).
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep("details")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => void onSave()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Saving…" : "Save & upload"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
