"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { collection, doc, setDoc } from "firebase/firestore"
import { addMonths, format, getDaysInMonth, parseISO } from "date-fns"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { costTypeConfig, selectableCostTypes, type CostWizardStepKey } from "@/lib/cost-item-config"
import {
  buildCostItemPayload,
  linearAnnualDepreciation,
  partialBusinessUseDeductible,
  vatQuarterMetaFromYmd,
} from "@/lib/cost-item-derive"
import { costItemToFirestorePayload } from "@/lib/cost-item-firestore"
import { validateCostItem } from "@/lib/cost-item-validate"
import {
  buildAfaMultiyearSlice,
  computeAfaDepreciationYearAmounts,
} from "@/lib/afa-depreciation-year-items"
import type {
  AfaAssetType,
  CostDocument,
  CostDocumentType,
  CostItem,
  VatCode,
  VendorOrigin,
  CostItemType,
  PauschaleType,
} from "@/lib/cost-item-types"
import { collectionForType, VAT_CODE_OPTIONS, VENDOR_ORIGIN_OPTIONS } from "@/lib/cost-item-types"
import type { ExtractedBillData } from "@/lib/bill-types"
import { getGoogleDriveAccessToken, uploadFileToGoogleDrive } from "@/lib/google-drive-upload-client"
import { buildCostAusgabeUploadedFilename } from "@/lib/document-filename"
import { fetchNextCostSequenceNumber } from "@/lib/cost-sequence"
import {
  resolveReferenceRatesForCostExpenseDate,
  unitsPerEurForCurrencyFromRow,
} from "@/lib/cost-reference-rates"
import { CostFormField, CostFormSection } from "@/components/costs/cost-item-form"
import {
  Calendar,
  FileText,
  Home,
  Layers,
  Loader2,
  Monitor,
  Receipt,
  Upload,
  Wallet,
  Wifi,
} from "lucide-react"

// ── helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string): number | undefined {
  const t = s.trim().replace(",", ".")
  if (t === "") return undefined
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : undefined
}

function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Returns YYYY-MM-DD for the first day of a given month index (0-based, relative to baseDate) */
function shiftMonth(baseDateYmd: string, monthOffset: number): string {
  const shifted = addMonths(parseISO(baseDateYmd), monthOffset)
  return format(shifted, "yyyy-MM-dd")
}

/** Build a human-readable label for a month offset, e.g. "May 2025" */
function monthLabel(baseDateYmd: string, offset: number): string {
  const shifted = addMonths(parseISO(baseDateYmd), offset)
  return format(shifted, "MMM yyyy")
}

// ── constants ────────────────────────────────────────────────────────────────

type PendingFile = {
  id: string
  file: File
  docType: CostDocumentType
  isPrimaryTaxDocument: boolean
}

const AFA_USEFUL_LIFE: Record<AfaAssetType, number> = {
  laptop: 3,
  monitor: 3,
  phone: 2,
  furniture: 5,
  office_equipment: 5,
  other: 3,
}

const PAUSCHALE_DEFAULTS: Record<
  PauschaleType,
  { method: "per_day" | "per_km" | "fixed_amount"; rate: string; legal: string }
> = {
  home_office: {
    method: "per_day",
    rate: "6",
    legal: "Home office flat rate — confirm eligible days with your advisor.",
  },
  mileage: {
    method: "per_km",
    rate: "0.38",
    legal: "Commuting / business mileage — rate depends on tax year.",
  },
  telephone_flat: {
    method: "fixed_amount",
    rate: "0",
    legal: "Phone/internet flat — set amount per internal rule or advisor agreement.",
  },
  other: { method: "fixed_amount", rate: "0", legal: "" },
}

const EUER_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
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

const TYPE_ICONS: Record<CostItemType, typeof Wallet> = {
  cost_invoice: Wallet,
  cost_partial_business_use: Wifi,
  cost_pauschale: Home,
  cost_afa: Monitor,
  cost_afa_multiyear_slice: Calendar,
}

const TYPE_DISPLAY: Record<CostItemType, { color: string; icon: typeof Wallet }> = {
  cost_invoice: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: Wallet },
  cost_partial_business_use: { color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Wifi },
  cost_pauschale: { color: "bg-green-100 text-green-700 border-green-200", icon: Home },
  cost_afa: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Monitor },
  cost_afa_multiyear_slice: { color: "bg-orange-100 text-orange-700 border-orange-200", icon: Calendar },
}

const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "JPY", "CAD", "AUD"]

const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
])

/** Best-guess currency from country code (non-EUR countries only). */
const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", JP: "JPY", CA: "CAD", AU: "AUD",
  NZ: "NZD", SG: "SGD", HK: "HKD", CN: "CNY", IN: "INR", BR: "BRL",
  MX: "MXN", ZA: "ZAR", RU: "RUB", TR: "TRY", RS: "RSD", UA: "UAH",
}

const CURRENCY_TOKEN_MAP: Record<string, string> = {
  EUR: "EUR",
  EURO: "EUR",
  "€": "EUR",
  USD: "USD",
  US$: "USD",
  "$": "USD",
  DOLLAR: "USD",
  DOLLARS: "USD",
  GBP: "GBP",
  "£": "GBP",
  POUND: "GBP",
  POUNDS: "GBP",
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
  BRL: "BRL",
  "R$": "BRL",
  MXN: "MXN",
  ZAR: "ZAR",
  RUB: "RUB",
  TRY: "TRY",
  RSD: "RSD",
  UAH: "UAH",
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

function normalizeExtractedCurrency(rawCurrency: string | null | undefined, countryCode: string | null | undefined): string | null {
  const cc = normalizeCountryCode(countryCode)
  const countryDefault = cc && !EU_COUNTRY_CODES.has(cc) ? (COUNTRY_DEFAULT_CURRENCY[cc] ?? null) : null

  const token = typeof rawCurrency === "string" ? rawCurrency.trim().toUpperCase() : ""
  if (token) {
    const direct = CURRENCY_TOKEN_MAP[token]
    if (direct) {
      // If the model defaulted to EUR but the merchant country uses a known non-EUR currency, trust the country.
      if (direct === "EUR" && countryDefault) return countryDefault
      return direct
    }
    if (/^[A-Z]{3}$/.test(token)) return token
  }
  return countryDefault
}

function inferVatCodeFromAmounts(
  subtotal: number | null | undefined,
  vatAmount: number | null | undefined,
  total?: number | null,
  lineItems?: Array<{ vatRate?: number }>,
): VatCode | "" {
  const vat = vatAmount ?? null
  // derive net: use subtotal directly, or compute from total - vatAmount when subtotal is missing
  const net = subtotal != null && subtotal !== 0
    ? subtotal
    : (total != null && vat != null ? total - vat : null)

  if (net != null && vat != null && Math.abs(net) > 0.005) {
    const rate = (vat / net) * 100
    if (Math.abs(rate - 19) < 2) return "Z35"
    if (Math.abs(rate - 7) < 1.5) return "Z36"
    if (Math.abs(rate) < 0.5) return "Z14"
  }

  // fallback: infer from the first line item that has an explicit vatRate
  const lineVatRate = lineItems?.find((li) => li.vatRate != null)?.vatRate
  if (lineVatRate != null) {
    // models may return percentage (19) or decimal (0.19)
    const pct = lineVatRate > 1 ? lineVatRate : lineVatRate * 100
    if (Math.abs(pct - 19) < 2) return "Z35"
    if (Math.abs(pct - 7) < 1.5) return "Z36"
    if (Math.abs(pct) < 0.5) return "Z14"
  }

  return ""
}

function inferVendorOriginFromCc(cc: string | null | undefined): VendorOrigin | "" {
  if (!cc) return ""
  const upper = cc.trim().toUpperCase()
  if (upper === "DE") return "domestic"
  if (EU_COUNTRY_CODES.has(upper)) return "eu"
  if (upper.length === 2) return "import"
  return ""
}

// ── component ────────────────────────────────────────────────────────────────

export function AddCostWizard({
  userId,
  onSaved,
  onCancel,
}: {
  userId: string
  onSaved?: () => void
  onCancel?: () => void
}) {
  const [phase, setPhase] = useState<"pick" | "steps">("pick")
  const [costType, setCostType] = useState<CostItemType | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // shared
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [notes, setNotes] = useState("")
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const uploadFileInputRef = useRef<HTMLInputElement>(null)
  /** ID of the PendingFile chosen by the user as the source for AI extraction */
  const [extractSourceFileId, setExtractSourceFileId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)

  // extracted vendor country code (shared across types, set on extraction)
  const [extractedVendorCc, setExtractedVendorCc] = useState<string | null>(null)

  // vatCode + vendorOrigin — one per type that has amounts
  const [invVatCode, setInvVatCode] = useState<VatCode | "">("")
  const [invVendorOrigin, setInvVendorOrigin] = useState<VendorOrigin | "">("")
  const [partVatCode, setPartVatCode] = useState<VatCode | "">("")
  const [partVendorOrigin, setPartVendorOrigin] = useState<VendorOrigin | "">("")
  const [afaVatCode, setAfaVatCode] = useState<VatCode | "">("")
  const [afaVendorOrigin, setAfaVendorOrigin] = useState<VendorOrigin | "">("")

  // cost_invoice
  const [invVendor, setInvVendor] = useState("")
  const [invInvoiceNo, setInvInvoiceNo] = useState("")
  const [invDate, setInvDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [invNet, setInvNet] = useState("")
  const [invVat, setInvVat] = useState("")
  const [invGross, setInvGross] = useState("")
  const [invVatDeductible, setInvVatDeductible] = useState(true)
  const [invPayment, setInvPayment] = useState<"unpaid" | "paid" | "partially_paid">("paid")
  const [invCurrency, setInvCurrency] = useState("EUR")
  const [invEurRate, setInvEurRate] = useState<number | null>(null)
  const [invEurRateDate, setInvEurRateDate] = useState<string | null>(null)
  const [fetchingEurRate, setFetchingEurRate] = useState(false)

  // cost_partial_business_use
  const [partVendor, setPartVendor] = useState("")
  const [partLine, setPartLine] = useState("")
  const [partInvoiceNo, setPartInvoiceNo] = useState("")
  const [partDate, setPartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [partNet, setPartNet] = useState("")
  const [partVat, setPartVat] = useState("")
  const [partGross, setPartGross] = useState("")
  const [partVatDeductible, setPartVatDeductible] = useState(true)
  const [partBizPct, setPartBizPct] = useState("20")
  const [partPayment, setPartPayment] = useState<"unpaid" | "paid" | "partially_paid">("paid")
  const [partCurrency, setPartCurrency] = useState("EUR")
  const [partEurRate, setPartEurRate] = useState<number | null>(null)
  const [partEurRateDate, setPartEurRateDate] = useState<string | null>(null)
  const [fetchingPartEurRate, setFetchingPartEurRate] = useState(false)

  // cost_pauschale
  const [pauschaleT, setPauschaleT] = useState<PauschaleType>("home_office")
  const [pauschaleQty, setPauschaleQty] = useState("1")
  const [pauschaleRate, setPauschaleRate] = useState(PAUSCHALE_DEFAULTS.home_office.rate)
  const [pauschaleMethod, setPauschaleMethod] = useState<"per_day" | "per_km" | "fixed_amount">("per_day")
  const [periodFrom, setPeriodFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodTo, setPeriodTo] = useState(`${new Date().getFullYear()}-12-31`)
  const [legalNote, setLegalNote] = useState(PAUSCHALE_DEFAULTS.home_office.legal)

  // cost_afa
  const [afaCurrency, setAfaCurrency] = useState("EUR")
  const [afaEurRate, setAfaEurRate] = useState<number | null>(null)
  const [afaEurRateDate, setAfaEurRateDate] = useState<string | null>(null)
  const [fetchingAfaEurRate, setFetchingAfaEurRate] = useState(false)
  const [afaAssetT, setAfaAssetT] = useState<AfaAssetType>("laptop")
  const [afaVendor, setAfaVendor] = useState("")
  const [afaInvoiceNo, setAfaInvoiceNo] = useState("")
  const [afaPurchaseDate, setAfaPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [afaNet, setAfaNet] = useState("")
  const [afaVat, setAfaVat] = useState("")
  const [afaGross, setAfaGross] = useState("")
  const [afaBizPct, setAfaBizPct] = useState("100")
  const [afaLife, setAfaLife] = useState(String(AFA_USEFUL_LIFE.laptop))
  const [afaStart, setAfaStart] = useState(format(new Date(), "yyyy-MM"))
  const [afaImmediate, setAfaImmediate] = useState(false)
  const [afaRegisterYearSlices, setAfaRegisterYearSlices] = useState(true)

  // recurring monthly
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringMonths, setRecurringMonths] = useState<number[]>([]) // offsets beyond month 0

  const steps = useMemo(() => {
    if (!costType) return [] as CostWizardStepKey[]
    return costTypeConfig[costType].steps
  }, [costType])

  const currentStepKey = steps[stepIndex] ?? null

  const resetAll = useCallback(() => {
    setPhase("pick")
    setCostType(null)
    setStepIndex(0)
    setTitle("")
    setCategory("")
    setSubcategory("")
    setNotes("")
    setPendingFiles([])
    setExtractedVendorCc(null)
    setInvVatCode("")
    setInvVendorOrigin("")
    setPartVatCode("")
    setPartVendorOrigin("")
    setAfaVatCode("")
    setAfaVendorOrigin("")
    setInvVendor("")
    setInvInvoiceNo("")
    setInvDate(format(new Date(), "yyyy-MM-dd"))
    setInvNet("")
    setInvVat("")
    setInvGross("")
    setInvVatDeductible(true)
    setInvPayment("paid")
    setInvCurrency("EUR")
    setInvEurRate(null)
    setInvEurRateDate(null)
    setFetchingEurRate(false)
    setPartVendor("")
    setPartLine("")
    setPartInvoiceNo("")
    setPartDate(format(new Date(), "yyyy-MM-dd"))
    setPartNet("")
    setPartVat("")
    setPartGross("")
    setPartVatDeductible(true)
    setPartBizPct("20")
    setPartPayment("paid")
    setPartCurrency("EUR")
    setPartEurRate(null)
    setPartEurRateDate(null)
    setFetchingPartEurRate(false)
    setPauschaleT("home_office")
    setPauschaleQty("1")
    setPauschaleRate(PAUSCHALE_DEFAULTS.home_office.rate)
    setPauschaleMethod("per_day")
    setPeriodFrom(`${new Date().getFullYear()}-01-01`)
    setPeriodTo(`${new Date().getFullYear()}-12-31`)
    setLegalNote(PAUSCHALE_DEFAULTS.home_office.legal)
    setAfaCurrency("EUR")
    setAfaEurRate(null)
    setAfaEurRateDate(null)
    setFetchingAfaEurRate(false)
    setAfaAssetT("laptop")
    setAfaVendor("")
    setAfaInvoiceNo("")
    setAfaPurchaseDate(format(new Date(), "yyyy-MM-dd"))
    setAfaNet("")
    setAfaVat("")
    setAfaGross("")
    setAfaBizPct("100")
    setAfaLife(String(AFA_USEFUL_LIFE.laptop))
    setAfaStart(format(new Date(), "yyyy-MM"))
    setAfaImmediate(false)
    setAfaRegisterYearSlices(true)
    setIsRecurring(false)
    setRecurringMonths([])
    setExtractSourceFileId(null)
    setExtracting(false)
  }, [])

  const closeFlow = () => {
    resetAll()
    onCancel?.()
  }

  const pickType = (t: CostItemType) => {
    setCostType(t)
    setPhase("steps")
    setStepIndex(0)
    if (t === "cost_pauschale") {
      const d = PAUSCHALE_DEFAULTS.home_office
      setPauschaleMethod(d.method)
      setPauschaleRate(d.rate)
      setLegalNote(d.legal)
    }
    const defaultTitles: Partial<Record<CostItemType, string>> = {
      cost_invoice: "Supplier cost",
      cost_partial_business_use: "Partial business expense",
      cost_pauschale: "Pauschale expense",
      cost_afa: "Business asset",
    }
    setTitle(defaultTitles[t] ?? "")
  }

  // ── file handling ────────────────────────────────────────────────────────

  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return
    const next: PendingFile[] = [...pendingFiles]
    // auto-extract only for types where extraction happens on upload step, not for cost_invoice
    const shouldAutoExtract =
      pendingFiles.length === 0 &&
      (costType === "cost_partial_business_use" || costType === "cost_afa")
    const firstAdded = files[0] ?? null

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      const id = newId()
      next.push({
        id,
        file,
        docType: next.length === 0 ? "invoice" : "payment_proof",
        isPrimaryTaxDocument: next.length === 0,
      })
    }
    if (next.length > 0) {
      next.forEach((p, idx) => { p.isPrimaryTaxDocument = idx === 0 })
    }
    setPendingFiles(next)
    // default extraction source to the first file added
    if (next.length > 0 && !extractSourceFileId) {
      setExtractSourceFileId(next[0].id)
    }

    if (shouldAutoExtract && firstAdded) {
      void runExtractForCostType(firstAdded, costType)
    }
  }

  const setPrimary = (id: string) => {
    setPendingFiles((rows) => rows.map((r) => ({ ...r, isPrimaryTaxDocument: r.id === id })))
  }

  const removeFile = (id: string) => {
    setPendingFiles((rows) => {
      const next = rows.filter((r) => r.id !== id)
      if (next.length === 1) next[0].isPrimaryTaxDocument = true
      return next
    })
  }

  // ── extraction ───────────────────────────────────────────────────────────

  async function extractFromFile(file: File): Promise<ExtractedBillData> {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/costs/extract", { method: "POST", body: fd })
    const data = (await res.json()) as { extracted?: ExtractedBillData; error?: string }
    if (!res.ok) throw new Error(data.error || "Extraction failed")
    if (!data.extracted) throw new Error("No extraction result")
    return data.extracted
  }

  const applyExtraction = (ex: ExtractedBillData, target: CostItemType) => {
    const cc = normalizeCountryCode(ex.merchantCountryCode) || null
    if (cc) setExtractedVendorCc(cc)
    const extractedCurrency = normalizeExtractedCurrency(ex.currency, cc)
    console.log("[applyExtraction] raw currency:", ex.currency, "→ normalized:", extractedCurrency, "cc:", cc, "target:", target)

    if (target === "cost_invoice") {
      if (ex.merchant) setInvVendor(ex.merchant)
      if (ex.invoiceNumber) setInvInvoiceNo(ex.invoiceNumber)
      if (ex.billDate) setInvDate(ex.billDate.trim().slice(0, 10))
      if (ex.subtotal != null) setInvNet(String(ex.subtotal))
      if (ex.vatAmount != null) setInvVat(String(ex.vatAmount))
      if (ex.total != null) setInvGross(String(ex.total))
      // auto-set currency and resolve reference rate when not EUR
      if (extractedCurrency) {
        console.log("[applyExtraction] calling setInvCurrency →", extractedCurrency)
        setInvCurrency(extractedCurrency)
        if (extractedCurrency !== "EUR") {
          const dateForRate = ex.billDate?.trim().slice(0, 10) ?? invDate
          void fetchInvEurRate(dateForRate, extractedCurrency)
        }
      }
      // auto-fill VAT code from extracted amounts
      const vatCode = inferVatCodeFromAmounts(ex.subtotal, ex.vatAmount, ex.total, ex.lineItems)
      if (vatCode) setInvVatCode(vatCode)
      // auto-fill vendor origin from extracted country code
      const origin = inferVendorOriginFromCc(cc)
      if (origin) setInvVendorOrigin(origin)
    }
    if (target === "cost_partial_business_use") {
      if (ex.merchant) setPartVendor(ex.merchant)
      if (ex.invoiceNumber) setPartInvoiceNo(ex.invoiceNumber)
      if (ex.billDate) setPartDate(ex.billDate.trim().slice(0, 10))
      if (ex.subtotal != null) setPartNet(String(ex.subtotal))
      if (ex.vatAmount != null) setPartVat(String(ex.vatAmount))
      if (ex.total != null) setPartGross(String(ex.total))
      if (extractedCurrency) {
        setPartCurrency(extractedCurrency)
        if (extractedCurrency !== "EUR") {
          const dateForRate = ex.billDate?.trim().slice(0, 10) ?? partDate
          void fetchPartEurRate(dateForRate, extractedCurrency)
        }
      }
      const partVatCode = inferVatCodeFromAmounts(ex.subtotal, ex.vatAmount, ex.total, ex.lineItems)
      if (partVatCode) setPartVatCode(partVatCode)
      const partOrigin = inferVendorOriginFromCc(cc)
      if (partOrigin) setPartVendorOrigin(partOrigin)
    }
    if (target === "cost_afa") {
      if (ex.merchant) setAfaVendor(ex.merchant)
      if (ex.invoiceNumber) setAfaInvoiceNo(ex.invoiceNumber)
      if (ex.billDate) setAfaPurchaseDate(ex.billDate.trim().slice(0, 10))
      if (ex.subtotal != null) setAfaNet(String(ex.subtotal))
      if (ex.vatAmount != null) setAfaVat(String(ex.vatAmount))
      if (ex.total != null) setAfaGross(String(ex.total))
      if (extractedCurrency) {
        setAfaCurrency(extractedCurrency)
        if (extractedCurrency !== "EUR") {
          const dateForRate = ex.billDate?.trim().slice(0, 10) ?? afaPurchaseDate
          void fetchAfaEurRate(dateForRate, extractedCurrency)
        }
      }
      const afaVatCode = inferVatCodeFromAmounts(ex.subtotal, ex.vatAmount, ex.total, ex.lineItems)
      if (afaVatCode) setAfaVatCode(afaVatCode)
      const afaOrigin = inferVendorOriginFromCc(cc)
      if (afaOrigin) setAfaVendorOrigin(afaOrigin)
    }
  }

  const runExtractForCostType = async (file: File, target: CostItemType | null) => {
    if (!target || (target !== "cost_invoice" && target !== "cost_partial_business_use" && target !== "cost_afa"))
      return
    setExtracting(true)
    try {
      const ex = await extractFromFile(file)
      applyExtraction(ex, target)
      toast({ title: "Values extracted", description: "Review and correct before saving." })
    } catch (e) {
      toast({
        title: "Extraction failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setExtracting(false)
    }
  }

  /** Used from the amounts step: extract from the user-chosen file */
  const runExtractFromSelected = async () => {
    if (!costType) return
    const sourceId = extractSourceFileId ?? pendingFiles[0]?.id
    const pending = pendingFiles.find((p) => p.id === sourceId) ?? pendingFiles[0]
    if (!pending) {
      toast({ title: "No file available", description: "Go back and upload a document first.", variant: "destructive" })
      return
    }
    await runExtractForCostType(pending.file, costType)
  }

  /** @deprecated kept for upload-step re-extract button */
  const runExtract = runExtractFromSelected

  /** BMF monthly row from Firestore for the expense month; if missing, no foreign rate (same as invoices). */
  const fetchInvEurRate = useCallback(
    async (date: string, currency: string) => {
      if (currency === "EUR" || !date) {
        setInvEurRate(null)
        setInvEurRateDate(null)
        return
      }
      setFetchingEurRate(true)
      try {
        const { rates } = await resolveReferenceRatesForCostExpenseDate({
          db,
          userId,
          expenseDateYmd: date,
          currency,
        })
        const rate = unitsPerEurForCurrencyFromRow(rates, currency)
        if (rate != null) {
          setInvEurRate(rate)
          setInvEurRateDate(date)
        } else {
          setInvEurRate(null)
          setInvEurRateDate(null)
        }
      } catch {
        setInvEurRate(null)
      } finally {
        setFetchingEurRate(false)
      }
    },
    [userId],
  )

  const fetchPartEurRate = useCallback(
    async (date: string, currency: string) => {
      if (currency === "EUR" || !date) {
        setPartEurRate(null)
        setPartEurRateDate(null)
        return
      }
      setFetchingPartEurRate(true)
      try {
        const { rates } = await resolveReferenceRatesForCostExpenseDate({
          db,
          userId,
          expenseDateYmd: date,
          currency,
        })
        const rate = unitsPerEurForCurrencyFromRow(rates, currency)
        if (rate != null) {
          setPartEurRate(rate)
          setPartEurRateDate(date)
        } else {
          setPartEurRate(null)
          setPartEurRateDate(null)
        }
      } catch {
        setPartEurRate(null)
      } finally {
        setFetchingPartEurRate(false)
      }
    },
    [userId],
  )

  const fetchAfaEurRate = useCallback(
    async (date: string, currency: string) => {
      if (currency === "EUR" || !date) {
        setAfaEurRate(null)
        setAfaEurRateDate(null)
        return
      }
      setFetchingAfaEurRate(true)
      try {
        const { rates } = await resolveReferenceRatesForCostExpenseDate({
          db,
          userId,
          expenseDateYmd: date,
          currency,
        })
        const rate = unitsPerEurForCurrencyFromRow(rates, currency)
        if (rate != null) {
          setAfaEurRate(rate)
          setAfaEurRateDate(date)
        } else {
          setAfaEurRate(null)
          setAfaEurRateDate(null)
        }
      } catch {
        setAfaEurRate(null)
      } finally {
        setFetchingAfaEurRate(false)
      }
    },
    [userId],
  )

  // Auto-resolve reference rate when entering amounts step with a foreign currency
  useEffect(() => {
    if (costType === "cost_invoice" && currentStepKey === "amounts" && invCurrency !== "EUR") {
      void fetchInvEurRate(invDate, invCurrency)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costType, currentStepKey, invCurrency])

  useEffect(() => {
    if (costType === "cost_partial_business_use" && currentStepKey === "amounts" && partCurrency !== "EUR") {
      void fetchPartEurRate(partDate, partCurrency)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costType, currentStepKey, partCurrency])

  useEffect(() => {
    if (costType === "cost_afa" && currentStepKey === "depreciation" && afaCurrency !== "EUR") {
      void fetchAfaEurRate(afaPurchaseDate, afaCurrency)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costType, currentStepKey, afaCurrency])

  // Auto-extract when arriving at the amounts step for cost_invoice (file already uploaded)
  useEffect(() => {
    if (
      costType === "cost_invoice" &&
      currentStepKey === "amounts" &&
      pendingFiles.length > 0 &&
      !extracting &&
      // only auto-extract if no data has been filled in yet
      invVendor === "" &&
      invNet === "" &&
      invGross === ""
    ) {
      void runExtractFromSelected()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costType, currentStepKey])

  // ── derived values ───────────────────────────────────────────────────────

  const pauschaleComputed = useMemo(() => {
    const q = parseNum(pauschaleQty) ?? 0
    const r = parseNum(pauschaleRate) ?? 0
    return Math.round(q * r * 100) / 100
  }, [pauschaleQty, pauschaleRate])

  useEffect(() => {
    if (costType !== "cost_pauschale") return
    const d = PAUSCHALE_DEFAULTS[pauschaleT]
    setPauschaleMethod(d.method)
    setPauschaleRate(d.rate)
    setLegalNote(d.legal)
  }, [pauschaleT, costType])

  useEffect(() => {
    if (costType !== "cost_afa") return
    setAfaLife(String(AFA_USEFUL_LIFE[afaAssetT]))
  }, [afaAssetT, costType])

  const afaYearSchedulePreview = useMemo(() => {
    if (costType !== "cost_afa" || afaImmediate) return null
    const life = Number.parseInt(afaLife, 10)
    if (!Number.isFinite(life) || life <= 1) return null
    const net = parseNum(afaNet) ?? 0
    const biz = parseNum(afaBizPct) ?? 100
    const startYmd = `${afaStart}-01`
    return computeAfaDepreciationYearAmounts({
      netPurchaseEur: net,
      usefulLifeYears: life,
      depreciationStartYmd: startYmd,
      businessUsePercent: biz,
    })
  }, [costType, afaImmediate, afaLife, afaNet, afaBizPct, afaStart])

  const partDed = useMemo(() => {
    const n = parseNum(partNet) ?? 0
    const v = parseNum(partVat) ?? 0
    const g = parseNum(partGross) ?? n + v
    const p = parseNum(partBizPct) ?? 0
    return partialBusinessUseDeductible({
      amountNet: n,
      amountVat: v,
      amountGross: g,
      businessUsePercent: Math.min(100, Math.max(0, p)),
    })
  }, [partNet, partVat, partGross, partBizPct])

  // ── recurring helpers ────────────────────────────────────────────────────

  /** Base date for recurring: invoice date of the first month */
  const recurringBaseDate = costType === "cost_invoice" ? invDate : partDate

  /** Remaining months in the year after the first one */
  const remainingMonthsInYear = useMemo(() => {
    try {
      const base = parseISO(recurringBaseDate)
      const dec = new Date(base.getFullYear(), 11, 31)
      const count = Math.round((dec.getTime() - base.getTime()) / (1000 * 60 * 60 * 24 * 30))
      return Math.max(0, Math.min(count, 11))
    } catch {
      return 0
    }
  }, [recurringBaseDate])

  const toggleRecurringMonth = (offset: number) => {
    setRecurringMonths((prev) =>
      prev.includes(offset) ? prev.filter((m) => m !== offset) : [...prev, offset].sort((a, b) => a - b),
    )
  }

  const selectAllRemainingMonths = () => {
    const offsets = Array.from({ length: remainingMonthsInYear }, (_, i) => i + 1)
    setRecurringMonths(offsets)
  }

  // ── validation ───────────────────────────────────────────────────────────

  const canNext = (): boolean => {
    if (!costType || !currentStepKey) return false
    if (currentStepKey === "upload") {
      if (costType === "cost_pauschale") return true
      if (costType === "cost_afa") return pendingFiles.length >= 1
      return pendingFiles.length >= 1
    }
    if (currentStepKey === "amounts") {
      if (costType === "cost_invoice")
        return invVendor.trim().length > 0 && parseNum(invNet) != null && parseNum(invGross) != null
      if (costType === "cost_partial_business_use")
        return partVendor.trim().length > 0 && parseNum(partNet) != null && parseNum(partGross) != null
      return true
    }
    if (currentStepKey === "tax-details") {
      return category.trim().length > 0
    }
    if (currentStepKey === "business-share") {
      return parseNum(partBizPct) != null
    }
    if (currentStepKey === "type") return true
    if (currentStepKey === "calculation") return pauschaleComputed > 0
    if (currentStepKey === "period") return periodFrom.trim().length > 0 && periodTo.trim().length > 0
    if (currentStepKey === "asset-type") return true
    if (currentStepKey === "depreciation") {
      if (afaImmediate) return afaVendor.trim().length > 0 && parseNum(afaNet) != null
      return (
        afaVendor.trim().length > 0 &&
        parseNum(afaNet) != null &&
        parseNum(afaLife) != null &&
        Number(afaLife) > 0
      )
    }
    if (currentStepKey === "recurring") return true
    return true
  }

  const goNext = () => {
    if (!canNext()) {
      toast({ title: "Check required fields", description: "Complete the current step.", variant: "destructive" })
      return
    }
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1)
  }

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
    else {
      setPhase("pick")
      setCostType(null)
    }
  }

  // ── Drive upload ─────────────────────────────────────────────────────────

  async function uploadPendingToDrive(): Promise<CostDocument[]> {
    if (!getGoogleDriveAccessToken()) {
      throw new Error("Connect Google Drive in the header to store documents.")
    }
    const billDateYmd =
      costType === "cost_invoice" ? invDate : costType === "cost_partial_business_use" ? partDate : afaPurchaseDate
    const merchantName =
      costType === "cost_invoice" ? invVendor : costType === "cost_partial_business_use" ? partVendor : afaVendor
    const nowIso = new Date().toISOString()
    const baseSeq = await fetchNextCostSequenceNumber(userId)
    const out: CostDocument[] = []
    for (let i = 0; i < pendingFiles.length; i++) {
      const p = pendingFiles[i]
      const seq = String(Number(baseSeq) + i).padStart(3, "0")
      const fileId = (
        await uploadFileToGoogleDrive(
          p.file,
          buildCostAusgabeUploadedFilename({
            billDate: billDateYmd,
            merchant: merchantName.trim() || "cost",
            countryCode: extractedVendorCc ?? null,
            kind: p.docType === "payment_proof" ? "bank_proof" : p.docType === "receipt" ? "receipt" : "invoice",
            originalFileName: p.file.name,
            sequenceNumber: seq,
          }),
        )
      ).fileId
      const qm = vatQuarterMetaFromYmd(billDateYmd) ?? vatQuarterMetaFromYmd(format(new Date(), "yyyy-MM-dd"))
      const paymentProof = p.docType === "payment_proof"
      out.push({
        id: fileId,
        type: p.docType,
        fileName: p.file.name,
        fileUrl: driveViewUrl(fileId),
        mimeType: p.file.type || undefined,
        createdAt: nowIso,
        vatRelevant: !paymentProof,
        euerRelevant: true,
        paymentProofOnly: paymentProof,
        quarter: qm?.vatQuarter,
        year: qm?.vatYear,
        isPrimaryTaxDocument: p.isPrimaryTaxDocument,
      })
    }
    return out
  }

  // ── build single cost item ────────────────────────────────────────────────

  /** Build one CostItem. For recurring future months pass expenseDateOverride + pending opts. */
  const buildSingleItem = (opts: {
    documents: CostDocument[]
    documentStatus: "uploaded" | "pending"
    expenseDateOverride?: string
    recurringGroupId?: string | null
    recurringMonthIndex?: number | null
    nowIso: string
  }): CostItem => {
    const newRef = doc(collection(db, collectionForType(costType!)))
    const id = newRef.id
    const { documents, documentStatus: docStatus, recurringGroupId, recurringMonthIndex, nowIso } = opts

    if (costType === "cost_invoice") {
      const expDate = opts.expenseDateOverride ?? invDate
      const net = parseNum(invNet) ?? 0
      const vat = parseNum(invVat) ?? 0
      const gross = parseNum(invGross) ?? net + vat
      const isForeignCurrency = invCurrency !== "EUR"
      const netEur = isForeignCurrency && invEurRate ? Math.round((net / invEurRate) * 100) / 100 : undefined
      const vatEur = isForeignCurrency && invEurRate ? Math.round((vat / invEurRate) * 100) / 100 : undefined
      const grossEur = isForeignCurrency && invEurRate ? Math.round((gross / invEurRate) * 100) / 100 : undefined
      return buildCostItemPayload({
        type: "cost_invoice",
        userId, id, nowIso,
        expenseDateYmd: expDate,
        title: title.trim() || "Supplier cost",
        category: category.trim() || "other",
        subcategory: subcategory.trim() || undefined,
        notes: notes.trim() || undefined,
        documents,
        documentStatus: docStatus,
        recurringGroupId: recurringGroupId ?? null,
        recurringMonthIndex: recurringMonthIndex ?? null,
        vatCode: invVatCode || undefined,
        vendorOrigin: invVendorOrigin || undefined,
        currency: invCurrency,
        amountNetEur: netEur,
        amountVatEur: vatEur,
        amountGrossEur: grossEur,
        eurRate: isForeignCurrency ? invEurRate ?? undefined : undefined,
        eurRateDate: isForeignCurrency ? invEurRateDate ?? undefined : undefined,
        invoice: {
          vendorName: invVendor.trim(),
          invoiceNumber: invInvoiceNo.trim() || undefined,
          expenseDate: expDate,
          amountNet: net,
          amountVat: vat,
          amountGross: gross,
          vatDeductible: invVatDeductible,
          businessUsePercent: 100,
          paymentStatus: invPayment,
        },
      })
    }

    if (costType === "cost_partial_business_use") {
      const expDate = opts.expenseDateOverride ?? partDate
      const net = parseNum(partNet) ?? 0
      const vat = parseNum(partVat) ?? 0
      const gross = parseNum(partGross) ?? net + vat
      const biz = parseNum(partBizPct) ?? 20
      const ded = partialBusinessUseDeductible({ amountNet: net, amountVat: vat, amountGross: gross, businessUsePercent: biz })
      const isPartForeign = partCurrency !== "EUR"
      const partNetEur = isPartForeign && partEurRate ? Math.round((net / partEurRate) * 100) / 100 : undefined
      const partVatEur = isPartForeign && partEurRate ? Math.round((vat / partEurRate) * 100) / 100 : undefined
      const partGrossEur = isPartForeign && partEurRate ? Math.round((gross / partEurRate) * 100) / 100 : undefined
      return buildCostItemPayload({
        type: "cost_partial_business_use",
        userId, id, nowIso,
        expenseDateYmd: expDate,
        title: title.trim() || "Partial business expense",
        category: category.trim() || "other",
        subcategory: subcategory.trim() || undefined,
        notes: notes.trim() || undefined,
        documents,
        documentStatus: docStatus,
        recurringGroupId: recurringGroupId ?? null,
        recurringMonthIndex: recurringMonthIndex ?? null,
        vatCode: partVatCode || undefined,
        vendorOrigin: partVendorOrigin || undefined,
        currency: partCurrency,
        amountNetEur: partNetEur,
        amountVatEur: partVatEur,
        amountGrossEur: partGrossEur,
        eurRate: isPartForeign ? partEurRate ?? undefined : undefined,
        eurRateDate: isPartForeign ? partEurRateDate ?? undefined : undefined,
        partial: {
          vendorName: partVendor.trim(),
          contractOrLineName: partLine.trim() || undefined,
          invoiceNumber: partInvoiceNo.trim() || undefined,
          expenseDate: expDate,
          amountNet: net,
          amountVat: vat,
          amountGross: gross,
          vatDeductible: partVatDeductible,
          businessUsePercent: biz,
          deductibleNetAmount: ded.deductibleNetAmount,
          deductibleVatAmount: ded.deductibleVatAmount,
          deductibleGrossAmount: ded.deductibleGrossAmount,
          paymentStatus: partPayment,
        },
      })
    }

    if (costType === "cost_pauschale") {
      return buildCostItemPayload({
        type: "cost_pauschale",
        userId, id, nowIso,
        expenseDateYmd: periodFrom,
        title: title.trim() || "Pauschale",
        category: category.trim() || "pauschale",
        subcategory: subcategory.trim() || undefined,
        notes: notes.trim() || undefined,
        documents,
        documentStatus: "uploaded",
        pauschale: {
          pauschaleType: pauschaleT,
          calculationMethod: pauschaleMethod,
          quantity: parseNum(pauschaleQty) ?? 0,
          rate: parseNum(pauschaleRate) ?? 0,
          calculatedAmount: pauschaleComputed,
          periodFrom,
          periodTo,
          legalNote: legalNote.trim() || undefined,
        },
      })
    }

    if (costType === "cost_afa") {
      const net = parseNum(afaNet) ?? 0
      const vat = parseNum(afaVat) ?? 0
      const gross = parseNum(afaGross) ?? net + vat
      const biz = parseNum(afaBizPct) ?? 100
      const life = afaImmediate ? undefined : Number.parseInt(afaLife, 10)
      const startYmd = `${afaStart}-01`
      const isAfaForeign = afaCurrency !== "EUR"
      const afaNetEur = isAfaForeign && afaEurRate ? Math.round((net / afaEurRate) * 100) / 100 : undefined
      const afaVatEurAmt = isAfaForeign && afaEurRate ? Math.round((vat / afaEurRate) * 100) / 100 : undefined
      const afaGrossEur = isAfaForeign && afaEurRate ? Math.round((gross / afaEurRate) * 100) / 100 : undefined
      // Depreciation uses EUR net if available (so AfA slices are in EUR)
      const netForDepreciation = afaNetEur ?? net
      const annual = afaImmediate
        ? netForDepreciation * (biz / 100)
        : life
          ? linearAnnualDepreciation({ amountNet: netForDepreciation, businessUsePercent: biz, usefulLifeYears: life })
          : undefined
      return buildCostItemPayload({
        type: "cost_afa",
        userId, id, nowIso,
        expenseDateYmd: afaPurchaseDate,
        purchaseDateYmd: afaPurchaseDate,
        title: title.trim() || "Asset",
        category: category.trim() || "hardware",
        subcategory: subcategory.trim() || undefined,
        notes: notes.trim() || undefined,
        documents,
        documentStatus: "uploaded",
        vatCode: afaVatCode || undefined,
        vendorOrigin: afaVendorOrigin || undefined,
        currency: afaCurrency,
        amountNetEur: afaNetEur,
        amountVatEur: afaVatEurAmt,
        amountGrossEur: afaGrossEur,
        eurRate: isAfaForeign ? afaEurRate ?? undefined : undefined,
        eurRateDate: isAfaForeign ? afaEurRateDate ?? undefined : undefined,
        afa: {
          assetType: afaAssetT,
          vendorName: afaVendor.trim(),
          invoiceNumber: afaInvoiceNo.trim() || undefined,
          purchaseDate: afaPurchaseDate,
          amountNet: net,
          amountVat: vat,
          amountGross: gross,
          businessUsePercent: biz,
          usefulLifeYears: life,
          depreciationStartDate: afaImmediate ? undefined : startYmd,
          annualDepreciationAmount: annual,
          immediateExpenseEligible: afaImmediate,
          hasMultiyearSlices: !afaImmediate && afaRegisterYearSlices && (life ?? 0) > 1,
        },
      })
    }

    throw new Error("No cost type")
  }

  // ── save ─────────────────────────────────────────────────────────────────

  const onSave = async () => {
    if (!costType) return
    setSaving(true)
    try {
      // Upload files — belong to the first (primary) month only
      let documents: CostDocument[] = []
      if (costType !== "cost_pauschale") {
        documents = await uploadPendingToDrive()
      }

      const nowIso = new Date().toISOString()
      const isRecurringType =
        isRecurring && (costType === "cost_invoice" || costType === "cost_partial_business_use")

      // Shared group id links all months of a recurring series
      const groupId = isRecurringType ? doc(collection(db, "_tmp")).id : null
      const allOffsets = isRecurringType ? [0, ...recurringMonths] : [0]

      let savedCount = 0

      for (const offset of allOffsets) {
        const isPrimary = offset === 0
        const expDate = shiftMonth(recurringBaseDate, offset)

        const item = buildSingleItem({
          documents: isPrimary ? documents : [],
          documentStatus: isPrimary ? "uploaded" : "pending",
          expenseDateOverride: expDate,
          recurringGroupId: groupId,
          recurringMonthIndex: isRecurringType ? offset : null,
          nowIso,
        })

        // AfA: disable includeInAnnualEuer when year slices will be written
        const lifeYears = item.type === "cost_afa" && !item.immediateExpenseEligible ? item.usefulLifeYears : undefined
        const shouldWriteYearSlices =
          item.type === "cost_afa" &&
          !afaImmediate &&
          afaRegisterYearSlices &&
          typeof lifeYears === "number" &&
          lifeYears > 1

        if (shouldWriteYearSlices) {
          item.includeInAnnualEuer = false
        }

        const errs = validateCostItem(item)
        if (errs.length) {
          toast({ title: "Cannot save", description: errs.join(" "), variant: "destructive" })
          setSaving(false)
          return
        }

        const newRef = doc(db, collectionForType(item.type), item.id)
        await setDoc(newRef, costItemToFirestorePayload(item))
        savedCount += 1

        // AfA multi-year slices — only for the primary (first) item
        let afaSliceCount = 0
        if (isPrimary && shouldWriteYearSlices && item.type === "cost_afa" && typeof lifeYears === "number") {
          const net = parseNum(afaNet) ?? 0
          const biz = parseNum(afaBizPct) ?? 100
          const startYmd = `${afaStart}-01`
          const yearSlices = computeAfaDepreciationYearAmounts({
            netPurchaseEur: net,
            usefulLifeYears: lifeYears,
            depreciationStartYmd: startYmd,
            businessUsePercent: biz,
          })
          for (const row of yearSlices) {
            const childRef = doc(collection(db, collectionForType("cost_afa_multiyear_slice")))
            const child = buildAfaMultiyearSlice({
              id: childRef.id,
              userId,
              parentAssetId: item.id,
              parentTitle: item.title,
              vendorName: item.vendorName ?? "",
              category: item.category,
              subcategory: item.subcategory,
              notes: item.notes,
              calendarYear: row.calendarYear,
              amountNet: row.amountNet,
              nowIso,
            })
            const ce = validateCostItem(child)
            if (ce.length) throw new Error(ce.join(" "))
            await setDoc(childRef, costItemToFirestorePayload(child))
            afaSliceCount += 1
          }
        }

        if (isPrimary && afaSliceCount > 0) {
          // just track, toast below
          void afaSliceCount
        }
      }

      const futureMonths = allOffsets.filter((o) => o !== 0).length
      let desc = "Your cost item was recorded."
      if (futureMonths > 0)
        desc += ` ${futureMonths} pending ${futureMonths === 1 ? "entry" : "entries"} created — upload invoices as they arrive.`
      toast({ title: "Cost saved", description: desc })
      onSaved?.()
      closeFlow()
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

  // ── render helpers ────────────────────────────────────────────────────────

  const stepLabel = (k: CostWizardStepKey) => {
    switch (k) {
      case "upload": return "Upload"
      case "amounts": return "Amounts"
      case "tax-details": return "Category"
      case "business-share": return "Business %"
      case "recurring": return "Recurring"
      case "review": return "Review"
      case "type": return "Type"
      case "calculation": return "Calculation"
      case "period": return "Period"
      case "asset-type": return "Asset"
      case "depreciation": return "Depreciation"
      default: return k
    }
  }

  const renderFileArea = () => {
    const isAfa = costType === "cost_afa"
    const btnLabel =
      isAfa
        ? pendingFiles.length === 0
          ? "Upload vendor receipt / invoice"
          : "Replace / add file"
        : pendingFiles.length === 0
          ? "Choose file(s)"
          : "Add more files"

    return (
      <div className="space-y-3">
        <input
          ref={uploadFileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple={!isAfa}
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        {pendingFiles.length === 0 ? (
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => uploadFileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">{btnLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG — data extracted automatically</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingFiles.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{p.file.name}</span>
                <Select
                  value={p.docType}
                  onValueChange={(v) =>
                    setPendingFiles((rows) =>
                      rows.map((r) => (r.id === p.id ? { ...r, docType: v as CostDocumentType } : r)),
                    )
                  }
                >
                  <SelectTrigger className="h-7 w-[130px]">
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
                {pendingFiles.length > 1 && (
                  <button
                    type="button"
                    title="Set as primary"
                    onClick={() => setPrimary(p.id)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs border",
                      p.isPrimaryTaxDocument
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground border-border hover:border-primary",
                    )}
                  >
                    {p.isPrimaryTaxDocument ? "Primary" : "Set primary"}
                  </button>
                )}
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 text-xs"
                  onClick={() => removeFile(p.id)}
                >
                  Remove
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => uploadFileInputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              {btnLabel}
            </Button>
          </div>
        )}

        {pendingFiles.length > 0 && costType !== "cost_invoice" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runExtract()}
            disabled={extracting}
            className="w-full"
          >
            {extracting ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Extracting…</>
            ) : (
              "Re-extract data from file"
            )}
          </Button>
        )}
      </div>
    )
  }

  const renderStep = () => {
    if (!costType || !currentStepKey) return null

    // ── upload ──────────────────────────────────────────────────────────────
    if (currentStepKey === "upload") {
      return (
        <CostFormSection title="Upload document">
          {renderFileArea()}
        </CostFormSection>
      )
    }

    // ── amounts — cost_invoice ──────────────────────────────────────────────
    if (currentStepKey === "amounts" && costType === "cost_invoice") {
      const hasFiles = pendingFiles.length > 0
      return (
        <div className="space-y-4">
          {/* AI extraction panel */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">Extract data from document</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void runExtractFromSelected()}
                disabled={!hasFiles || extracting}
              >
                {extracting ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Extracting…</>
                ) : (
                  <>Extract with AI</>
                )}
              </Button>
            </div>
            {hasFiles ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Select which file to send to AI:</p>
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((p) => {
                    const isSelected = (extractSourceFileId ?? pendingFiles[0]?.id) === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setExtractSourceFileId(p.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-background hover:border-primary/50",
                        )}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="max-w-[160px] truncate">{p.file.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No files uploaded yet — go back to the upload step to add a document.
              </p>
            )}
          </div>

          <CostFormSection title="Vendor details">
            <CostFormField label="Vendor name *">
              <Input value={invVendor} onChange={(e) => setInvVendor(e.target.value)} placeholder="e.g. Amazon" />
            </CostFormField>
            <CostFormField label="Invoice number">
              <Input value={invInvoiceNo} onChange={(e) => setInvInvoiceNo(e.target.value)} placeholder="INV-001" />
            </CostFormField>
            <CostFormField label="Invoice date *">
              <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
            </CostFormField>
          </CostFormSection>
          <CostFormSection title="Amounts">
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label="Currency">
                <Select value={invCurrency} onValueChange={(v) => {
                  setInvCurrency(v)
                  if (v !== "EUR") void fetchInvEurRate(invDate, v)
                  else { setInvEurRate(null); setInvEurRateDate(null) }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="Vendor origin">
                <Select value={invVendorOrigin} onValueChange={(v) => setInvVendorOrigin(v as VendorOrigin)}>
                  <SelectTrigger><SelectValue placeholder="Select origin…" /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_ORIGIN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="VAT rate">
                <Select
                  value={invVatCode}
                  onValueChange={(v) => {
                    const code = v as VatCode
                    setInvVatCode(code)
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === code)
                    const net = parseNum(invNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      setInvVat(String(vatAmt))
                      setInvGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select VAT rate…" /></SelectTrigger>
                  <SelectContent>
                    {VAT_CODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label={`Net * (${invCurrency})`}>
                <Input
                  value={invNet}
                  onChange={(e) => setInvNet(e.target.value)}
                  placeholder="0.00"
                  onBlur={() => {
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === invVatCode)
                    const net = parseNum(invNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      if (!invVat) setInvVat(String(vatAmt))
                      if (!invGross) setInvGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                />
              </CostFormField>
              <CostFormField label={`VAT (${invCurrency})`}>
                <Input value={invVat} onChange={(e) => setInvVat(e.target.value)} placeholder="0.00" />
              </CostFormField>
              <CostFormField label={`Gross * (${invCurrency})`}>
                <Input value={invGross} onChange={(e) => setInvGross(e.target.value)} placeholder="0.00" />
              </CostFormField>
            </div>
            {invCurrency !== "EUR" && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                {fetchingEurRate ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Resolving reference rate…</span>
                ) : invEurRate ? (
                  <>
                    <p className="text-muted-foreground">
                      Reference rate on {invEurRateDate}: 1 EUR = {invEurRate.toFixed(4)} {invCurrency}
                    </p>
                    {parseNum(invNet) != null && (
                      <p className="font-medium">
                        ≈ €{(parseNum(invNet)! / invEurRate).toFixed(2)} net
                        {parseNum(invGross) != null && ` · €${(parseNum(invGross)! / invEurRate).toFixed(2)} gross`}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    No reference rate for {invDate} —
                    <button type="button" className="underline" onClick={() => void fetchInvEurRate(invDate, invCurrency)}>retry</button>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="inv-vat-ded"
                checked={invVatDeductible}
                onCheckedChange={(c) => setInvVatDeductible(Boolean(c))}
              />
              <Label htmlFor="inv-vat-ded" className="text-sm">
                VAT deductible (include in VAT quarterly report)
              </Label>
            </div>
          </CostFormSection>
          <CostFormSection title="Payment">
            <Select value={invPayment} onValueChange={(v) => setInvPayment(v as typeof invPayment)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
              </SelectContent>
            </Select>
          </CostFormSection>
        </div>
      )
    }

    // ── amounts — cost_partial_business_use ─────────────────────────────────
    if (currentStepKey === "amounts" && costType === "cost_partial_business_use") {
      return (
        <div className="space-y-4">
          <CostFormSection title="Vendor details">
            <CostFormField label="Vendor name *">
              <Input value={partVendor} onChange={(e) => setPartVendor(e.target.value)} placeholder="e.g. Deutsche Telekom" />
            </CostFormField>
            <CostFormField label="Contract / line name">
              <Input value={partLine} onChange={(e) => setPartLine(e.target.value)} placeholder="Mobile contract, home broadband…" />
            </CostFormField>
            <CostFormField label="Invoice number">
              <Input value={partInvoiceNo} onChange={(e) => setPartInvoiceNo(e.target.value)} placeholder="INV-001" />
            </CostFormField>
            <CostFormField label="Invoice date *">
              <Input type="date" value={partDate} onChange={(e) => setPartDate(e.target.value)} />
            </CostFormField>
          </CostFormSection>
          <CostFormSection title="Amounts">
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label="Currency">
                <Select value={partCurrency} onValueChange={(v) => {
                  setPartCurrency(v)
                  if (v !== "EUR") void fetchPartEurRate(partDate, v)
                  else { setPartEurRate(null); setPartEurRateDate(null) }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="Vendor origin">
                <Select value={partVendorOrigin} onValueChange={(v) => setPartVendorOrigin(v as VendorOrigin)}>
                  <SelectTrigger><SelectValue placeholder="Select origin…" /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_ORIGIN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="VAT rate">
                <Select
                  value={partVatCode}
                  onValueChange={(v) => {
                    const code = v as VatCode
                    setPartVatCode(code)
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === code)
                    const net = parseNum(partNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      setPartVat(String(vatAmt))
                      setPartGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select VAT rate…" /></SelectTrigger>
                  <SelectContent>
                    {VAT_CODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label={`Net * (${partCurrency})`}>
                <Input
                  value={partNet}
                  onChange={(e) => setPartNet(e.target.value)}
                  placeholder="0.00"
                  onBlur={() => {
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === partVatCode)
                    const net = parseNum(partNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      if (!partVat) setPartVat(String(vatAmt))
                      if (!partGross) setPartGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                />
              </CostFormField>
              <CostFormField label={`VAT (${partCurrency})`}>
                <Input value={partVat} onChange={(e) => setPartVat(e.target.value)} placeholder="0.00" />
              </CostFormField>
              <CostFormField label={`Gross * (${partCurrency})`}>
                <Input value={partGross} onChange={(e) => setPartGross(e.target.value)} placeholder="0.00" />
              </CostFormField>
            </div>
            {partCurrency !== "EUR" && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                {fetchingPartEurRate ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Resolving reference rate…</span>
                ) : partEurRate ? (
                  <>
                    <p className="text-muted-foreground">Reference rate on {partEurRateDate}: 1 EUR = {partEurRate.toFixed(4)} {partCurrency}</p>
                    {parseNum(partNet) != null && (
                      <p className="font-medium">
                        ≈ €{(parseNum(partNet)! / partEurRate).toFixed(2)} net
                        {parseNum(partGross) != null && ` · €${(parseNum(partGross)! / partEurRate).toFixed(2)} gross`}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    No reference rate for {partDate} —
                    <button type="button" className="underline" onClick={() => void fetchPartEurRate(partDate, partCurrency)}>retry</button>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="part-vat-ded"
                checked={partVatDeductible}
                onCheckedChange={(c) => setPartVatDeductible(Boolean(c))}
              />
              <Label htmlFor="part-vat-ded" className="text-sm">
                VAT deductible on business share
              </Label>
            </div>
          </CostFormSection>
        </div>
      )
    }

    // ── tax-details (cost_invoice) ──────────────────────────────────────────
    if (currentStepKey === "tax-details") {
      return (
        <div className="space-y-4">
          <CostFormSection title="EÜR category">
            <CostFormField label="Category *">
              <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select…</SelectItem>
                  {EUER_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CostFormField>
            <CostFormField label="Title / description">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name for the register" />
            </CostFormField>
            <CostFormField label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
            </CostFormField>
          </CostFormSection>
        </div>
      )
    }

    // ── business-share (cost_partial_business_use) ──────────────────────────
    if (currentStepKey === "business-share") {
      return (
        <div className="space-y-4">
          <CostFormSection title="Business use percentage">
            <p className="text-sm text-muted-foreground">
              Set how much of this expense is for business. E.g. 20 % for internet, 50 % for a shared phone plan.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                className="w-28"
                value={partBizPct}
                onChange={(e) => setPartBizPct(e.target.value)}
                placeholder="20"
              />
              <span className="text-sm text-muted-foreground">% business use</span>
            </div>
            {parseNum(partNet) != null && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductible net</span>
                  <span className="font-medium">€ {partDed.deductibleNetAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductible VAT</span>
                  <span className="font-medium">€ {partDed.deductibleVatAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CostFormSection>
          <CostFormSection title="EÜR category">
            <CostFormField label="Category *">
              <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select…</SelectItem>
                  {EUER_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CostFormField>
            <CostFormField label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name" />
            </CostFormField>
            <CostFormField label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
            </CostFormField>
          </CostFormSection>
        </div>
      )
    }

    // ── recurring ───────────────────────────────────────────────────────────
    if (currentStepKey === "recurring") {
      const supportsRecurring = costTypeConfig[costType]?.supportsRecurring ?? false
      if (!supportsRecurring) return null

      return (
        <CostFormSection title="Recurring monthly entries">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-recurring"
                checked={isRecurring}
                onCheckedChange={(c) => {
                  setIsRecurring(Boolean(c))
                  if (!c) setRecurringMonths([])
                }}
              />
              <Label htmlFor="is-recurring" className="text-sm font-medium">
                This is a recurring monthly cost
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-3 pl-6 border-l ml-2">
                <p className="text-sm text-muted-foreground">
                  Select which other months to create entries for.{" "}
                  <strong>Month 0 (this invoice) is always saved with the file you uploaded.</strong>{" "}
                  Future months will be created with{" "}
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">pending invoice</span>
                  {" "}— you can upload the file later.
                </p>
                <Button variant="outline" size="sm" onClick={selectAllRemainingMonths} type="button">
                  Select all remaining months this year
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 11 }, (_, i) => i + 1)
                    .filter((offset) => offset <= remainingMonthsInYear + 1)
                    .map((offset) => {
                      const label = monthLabel(recurringBaseDate, offset)
                      const checked = recurringMonths.includes(offset)
                      return (
                        <button
                          key={offset}
                          type="button"
                          onClick={() => toggleRecurringMonth(offset)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                            checked
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary/50",
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                </div>
                {recurringMonths.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {recurringMonths.length} separate{" "}
                    {recurringMonths.length === 1 ? "entry" : "entries"} will be created as{" "}
                    <span className="font-medium">pending — document needed</span>.
                    Upload invoices as they arrive each month.
                  </p>
                )}
              </div>
            )}
          </div>
        </CostFormSection>
      )
    }

    // ── pauschale: type ─────────────────────────────────────────────────────
    if (currentStepKey === "type" && costType === "cost_pauschale") {
      return (
        <CostFormSection title="Pauschale type">
          <div className="grid grid-cols-2 gap-3">
            {(["home_office", "mileage", "telephone_flat", "other"] as PauschaleType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPauschaleT(t)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors",
                  pauschaleT === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                )}
              >
                <p className="font-medium capitalize">{t.replace("_", " ")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{PAUSCHALE_DEFAULTS[t].legal.slice(0, 50) || "Custom flat rate"}</p>
              </button>
            ))}
          </div>
        </CostFormSection>
      )
    }

    // ── pauschale: calculation ──────────────────────────────────────────────
    if (currentStepKey === "calculation" && costType === "cost_pauschale") {
      return (
        <div className="space-y-4">
          <CostFormSection title="Calculation">
            <CostFormField label="Method">
              <Select value={pauschaleMethod} onValueChange={(v) => setPauschaleMethod(v as typeof pauschaleMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_day">Per day</SelectItem>
                  <SelectItem value="per_km">Per km</SelectItem>
                  <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </CostFormField>
            <div className="grid grid-cols-2 gap-3">
              <CostFormField label={pauschaleMethod === "per_day" ? "Days" : pauschaleMethod === "per_km" ? "Km" : "Amount"}>
                <Input value={pauschaleQty} onChange={(e) => setPauschaleQty(e.target.value)} placeholder="0" />
              </CostFormField>
              <CostFormField label="Rate (€)">
                <Input value={pauschaleRate} onChange={(e) => setPauschaleRate(e.target.value)} placeholder="0.00" />
              </CostFormField>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Calculated amount</span>
              <span className="font-semibold">€ {pauschaleComputed.toFixed(2)}</span>
            </div>
          </CostFormSection>
          <CostFormSection title="EÜR category">
            <CostFormField label="Category">
              <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select…</SelectItem>
                  {EUER_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CostFormField>
            <CostFormField label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name" />
            </CostFormField>
            {legalNote && (
              <p className="text-xs text-muted-foreground bg-muted rounded p-2">{legalNote}</p>
            )}
          </CostFormSection>
        </div>
      )
    }

    // ── pauschale: period ───────────────────────────────────────────────────
    if (currentStepKey === "period" && costType === "cost_pauschale") {
      return (
        <CostFormSection title="Period covered">
          <div className="grid grid-cols-2 gap-3">
            <CostFormField label="From">
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </CostFormField>
            <CostFormField label="To">
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </CostFormField>
          </div>
          <CostFormField label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Q1 2025 home office days" />
          </CostFormField>
        </CostFormSection>
      )
    }

    // ── asset-type ──────────────────────────────────────────────────────────
    if (currentStepKey === "asset-type" && costType === "cost_afa") {
      return (
        <CostFormSection title="Asset type">
          <div className="grid grid-cols-3 gap-2">
            {(["laptop", "monitor", "phone", "furniture", "office_equipment", "other"] as AfaAssetType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAfaAssetT(t)}
                className={cn(
                  "rounded-lg border p-3 text-sm text-center transition-colors",
                  afaAssetT === t ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50",
                )}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </CostFormSection>
      )
    }

    // ── depreciation (cost_afa) ─────────────────────────────────────────────
    if (currentStepKey === "depreciation" && costType === "cost_afa") {
      return (
        <div className="space-y-4">
          <CostFormSection title="Purchase details">
            <CostFormField label="Vendor *">
              <Input value={afaVendor} onChange={(e) => setAfaVendor(e.target.value)} placeholder="e.g. Apple" />
            </CostFormField>
            <CostFormField label="Invoice number">
              <Input value={afaInvoiceNo} onChange={(e) => setAfaInvoiceNo(e.target.value)} placeholder="INV-001" />
            </CostFormField>
            <CostFormField label="Purchase date">
              <Input type="date" value={afaPurchaseDate} onChange={(e) => setAfaPurchaseDate(e.target.value)} />
            </CostFormField>
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label="Currency">
                <Select value={afaCurrency} onValueChange={(v) => {
                  setAfaCurrency(v)
                  if (v !== "EUR") void fetchAfaEurRate(afaPurchaseDate, v)
                  else { setAfaEurRate(null); setAfaEurRateDate(null) }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="Vendor origin">
                <Select value={afaVendorOrigin} onValueChange={(v) => setAfaVendorOrigin(v as VendorOrigin)}>
                  <SelectTrigger><SelectValue placeholder="Select origin…" /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_ORIGIN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
              <CostFormField label="VAT rate">
                <Select
                  value={afaVatCode}
                  onValueChange={(v) => {
                    const code = v as VatCode
                    setAfaVatCode(code)
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === code)
                    const net = parseNum(afaNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      setAfaVat(String(vatAmt))
                      setAfaGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select VAT rate…" /></SelectTrigger>
                  <SelectContent>
                    {VAT_CODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CostFormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CostFormField label={`Net * (${afaCurrency})`}>
                <Input
                  value={afaNet}
                  onChange={(e) => setAfaNet(e.target.value)}
                  placeholder="0.00"
                  onBlur={() => {
                    const opt = VAT_CODE_OPTIONS.find((o) => o.value === afaVatCode)
                    const net = parseNum(afaNet)
                    if (opt && net != null) {
                      const vatAmt = Math.round(net * opt.rate * 100) / 100
                      if (!afaVat) setAfaVat(String(vatAmt))
                      if (!afaGross) setAfaGross(String(Math.round((net + vatAmt) * 100) / 100))
                    }
                  }}
                />
              </CostFormField>
              <CostFormField label={`VAT (${afaCurrency})`}>
                <Input value={afaVat} onChange={(e) => setAfaVat(e.target.value)} placeholder="0.00" />
              </CostFormField>
              <CostFormField label={`Gross (${afaCurrency})`}>
                <Input value={afaGross} onChange={(e) => setAfaGross(e.target.value)} placeholder="0.00" />
              </CostFormField>
            </div>
            {afaCurrency !== "EUR" && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                {fetchingAfaEurRate ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Resolving reference rate…</span>
                ) : afaEurRate ? (
                  <>
                    <p className="text-muted-foreground">Reference rate on {afaEurRateDate}: 1 EUR = {afaEurRate.toFixed(4)} {afaCurrency}</p>
                    {parseNum(afaNet) != null && (
                      <p className="font-medium">
                        ≈ €{(parseNum(afaNet)! / afaEurRate).toFixed(2)} net
                        {parseNum(afaGross) != null && ` · €${(parseNum(afaGross)! / afaEurRate).toFixed(2)} gross`}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    No reference rate for {afaPurchaseDate} —
                    <button type="button" className="underline" onClick={() => void fetchAfaEurRate(afaPurchaseDate, afaCurrency)}>retry</button>
                  </span>
                )}
              </div>
            )}
            <CostFormField label="Business use %">
              <Input type="number" min={0} max={100} value={afaBizPct} onChange={(e) => setAfaBizPct(e.target.value)} className="w-28" />
            </CostFormField>
          </CostFormSection>
          <CostFormSection title="Depreciation">
            <div className="flex items-center gap-2">
              <Checkbox id="afa-immediate" checked={afaImmediate} onCheckedChange={(c) => setAfaImmediate(Boolean(c))} />
              <Label htmlFor="afa-immediate" className="text-sm">Immediate expense (GWG / full deduction in purchase year)</Label>
            </div>
            {!afaImmediate && (
              <>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <CostFormField label="Useful life (years)">
                    <Input type="number" min={1} max={30} value={afaLife} onChange={(e) => setAfaLife(e.target.value)} className="w-24" />
                  </CostFormField>
                  <CostFormField label="Depreciation start (month)">
                    <Input type="month" value={afaStart} onChange={(e) => setAfaStart(e.target.value)} />
                  </CostFormField>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="afa-slices"
                    checked={afaRegisterYearSlices}
                    onCheckedChange={(c) => setAfaRegisterYearSlices(Boolean(c))}
                  />
                  <Label htmlFor="afa-slices" className="text-sm">
                    Create yearly AfA entries for EÜR (one per calendar year)
                  </Label>
                </div>
                {afaYearSchedulePreview && afaYearSchedulePreview.length > 0 && afaRegisterYearSlices && (
                  <div className="rounded-md border mt-2 text-sm overflow-hidden">
                    <div className="bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">AfA schedule preview</div>
                    {afaYearSchedulePreview.map((row) => (
                      <div key={row.calendarYear} className="flex justify-between px-3 py-1 border-t">
                        <span>{row.calendarYear}</span>
                        <span className="font-medium">€ {row.amountNet.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CostFormSection>
          <CostFormSection title="EÜR category">
            <CostFormField label="Category">
              <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select…</SelectItem>
                  {EUER_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CostFormField>
            <CostFormField label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name" />
            </CostFormField>
            <CostFormField label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
            </CostFormField>
          </CostFormSection>
        </div>
      )
    }

    // ── review ──────────────────────────────────────────────────────────────
    if (currentStepKey === "review") {
      const cfg = costTypeConfig[costType]
      const recurringPreview =
        isRecurring && recurringMonths.length > 0
          ? recurringMonths.map((offset) => monthLabel(recurringBaseDate, offset))
          : []

      return (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {cfg.includeInVatQuarter ? (
              <Badge variant="default">Included in VAT quarter</Badge>
            ) : (
              <Badge variant="secondary">EÜR only — no VAT quarter</Badge>
            )}
            <Badge variant="outline">EÜR from document date</Badge>
            {isRecurring && recurringPreview.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Layers className="h-3 w-3" />
                +{recurringPreview.length} pending {recurringPreview.length === 1 ? "entry" : "entries"} (document needed)
              </Badge>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-1.5">
            <Row label="Type" value={cfg.label} />
            <Row label="Title" value={title || "—"} />
            <Row label="Category" value={(EUER_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category) || "—"} />

            {(costType === "cost_invoice") && (
              <>
                <Separator className="my-1" />
                <Row label="Vendor" value={invVendor || "—"} />
                <Row label="Date" value={invDate} />
                {invCurrency !== "EUR" ? (
                  <>
                    <Row label={`Net (${invCurrency})`} value={invNet ? `${invCurrency} ${invNet}` : "—"} />
                    <Row label={`VAT (${invCurrency})`} value={invVat ? `${invCurrency} ${invVat}` : "—"} />
                    <Row label={`Gross (${invCurrency})`} value={invGross ? `${invCurrency} ${invGross}` : "—"} />
                    {invEurRate && parseNum(invNet) != null && (
                      <>
                        <Row label="Net (EUR)" value={`€ ${(parseNum(invNet)! / invEurRate).toFixed(2)}`} />
                        <Row label="Gross (EUR)" value={parseNum(invGross) != null ? `€ ${(parseNum(invGross)! / invEurRate).toFixed(2)}` : "—"} />
                        <Row label="Reference rate" value={`1 EUR = ${invEurRate.toFixed(4)} ${invCurrency} (${invEurRateDate})`} />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Row label="Net" value={invNet ? `€ ${invNet}` : "—"} />
                    <Row label="VAT" value={invVat ? `€ ${invVat}` : "—"} />
                    <Row label="Gross" value={invGross ? `€ ${invGross}` : "—"} />
                  </>
                )}
                <Row label="VAT deductible" value={invVatDeductible ? "Yes" : "No"} />
                <Row label="Payment" value={invPayment} />
              </>
            )}

            {(costType === "cost_partial_business_use") && (
              <>
                <Separator className="my-1" />
                <Row label="Vendor" value={partVendor || "—"} />
                <Row label="Date" value={partDate} />
                {partCurrency !== "EUR" ? (
                  <>
                    <Row label={`Net (${partCurrency})`} value={partNet ? `${partCurrency} ${partNet}` : "—"} />
                    <Row label={`VAT (${partCurrency})`} value={partVat ? `${partCurrency} ${partVat}` : "—"} />
                    <Row label={`Gross (${partCurrency})`} value={partGross ? `${partCurrency} ${partGross}` : "—"} />
                    {partEurRate && parseNum(partNet) != null && (
                      <>
                        <Row label="Net (EUR)" value={`€ ${(parseNum(partNet)! / partEurRate).toFixed(2)}`} />
                        <Row
                          label="Gross (EUR)"
                          value={parseNum(partGross) != null ? `€ ${(parseNum(partGross)! / partEurRate).toFixed(2)}` : "—"}
                        />
                        <Row
                          label="Reference rate"
                          value={`1 EUR = ${partEurRate.toFixed(4)} ${partCurrency}${partEurRateDate ? ` (${partEurRateDate})` : ""}`}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Row label="Net" value={partNet ? `€ ${partNet}` : "—"} />
                    <Row label="VAT" value={partVat ? `€ ${partVat}` : "—"} />
                    <Row label="Gross" value={partGross ? `€ ${partGross}` : "—"} />
                  </>
                )}
                <Row label="Business share" value={`${partBizPct} %`} />
                <Row label="Deductible net" value={`€ ${partDed.deductibleNetAmount.toFixed(2)}`} />
                <Row label="Deductible VAT" value={`€ ${partDed.deductibleVatAmount.toFixed(2)}`} />
                <Row label="Payment" value={partPayment} />
              </>
            )}

            {(costType === "cost_pauschale") && (
              <>
                <Separator className="my-1" />
                <Row label="Pauschale type" value={pauschaleT.replace("_", " ")} />
                <Row label="Calculated" value={`€ ${pauschaleComputed.toFixed(2)}`} />
                <Row label="Period" value={`${periodFrom} → ${periodTo}`} />
              </>
            )}

            {(costType === "cost_afa") && (
              <>
                <Separator className="my-1" />
                <Row label="Asset type" value={afaAssetT.replace("_", " ")} />
                <Row label="Vendor" value={afaVendor || "—"} />
                {afaCurrency !== "EUR" ? (
                  <>
                    <Row label={`Net (${afaCurrency})`} value={afaNet ? `${afaCurrency} ${afaNet}` : "—"} />
                    {afaEurRate && parseNum(afaNet) != null && (
                      <>
                        <Row label="Net (EUR)" value={`€ ${(parseNum(afaNet)! / afaEurRate).toFixed(2)}`} />
                        <Row label="Reference rate" value={`1 EUR = ${afaEurRate.toFixed(4)} ${afaCurrency}`} />
                      </>
                    )}
                  </>
                ) : (
                  <Row label="Net" value={afaNet ? `€ ${afaNet}` : "—"} />
                )}
                <Row label="Business use" value={`${afaBizPct} %`} />
                {afaImmediate ? (
                  <Row label="Depreciation" value="Immediate expense (GWG)" />
                ) : (
                  <>
                    <Row label="Useful life" value={`${afaLife} years`} />
                    <Row label="Year slices" value={afaRegisterYearSlices ? `Yes (${afaYearSchedulePreview?.length ?? 0} years)` : "No"} />
                  </>
                )}
              </>
            )}

            {pendingFiles.length > 0 && (
              <>
                <Separator className="my-1" />
                <Row label="Documents" value={`${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} to upload`} />
              </>
            )}

            {recurringPreview.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recurring months</span>
                  <span className="text-right text-sm">{recurringPreview.join(", ")}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-0.5">
                  All months stored in <strong>one record</strong>. Future months marked{" "}
                  <strong>pending</strong> — upload invoices as they arrive.
                </p>
              </>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  // ── main render ───────────────────────────────────────────────────────────

  if (phase === "pick") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add cost</CardTitle>
          <CardDescription>Choose the type of cost you want to record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {selectableCostTypes.map((t) => {
              const cfg = costTypeConfig[t]
              const disp = TYPE_DISPLAY[t]
              const Icon = disp.icon
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className="rounded-xl border p-4 text-left hover:border-primary transition-colors group"
                >
                  <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium mb-2", disp.color)}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.shortLabel}
                  </div>
                  <p className="font-medium text-sm group-hover:text-primary">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                </button>
              )
            })}
          </div>
          <div className="pt-2">
            <Button variant="ghost" onClick={closeFlow}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // steps phase
  const cfg = costType ? costTypeConfig[costType] : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{cfg?.label ?? "Add cost"}</CardTitle>
            <CardDescription>{cfg?.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={closeFlow}>Cancel</Button>
        </div>
        {/* step indicator */}
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {steps.map((sk, i) => (
            <div key={sk} className="flex items-center gap-1">
              <div
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  i < stepIndex
                    ? "bg-primary text-primary-foreground"
                    : i === stepIndex
                      ? "bg-primary/10 text-primary border border-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {stepLabel(sk)}
              </div>
              {i < steps.length - 1 && <div className="h-px w-3 bg-border" />}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderStep()}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={goBack} disabled={saving}>
            {stepIndex === 0 ? "Back to types" : "Back"}
          </Button>
          {stepIndex < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canNext()}>
              Next
            </Button>
          ) : (
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save cost
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── tiny helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
