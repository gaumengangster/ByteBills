import { format } from "date-fns"
import { resolveCountryCodeForFilename } from "./client-country"

type DocumentData = {
  invoiceNumber?: string
  receiptNumber?: string
  deliveryNoteNumber?: string
  invoiceDate?: string | Date
  receiptDate?: string | Date
  deliveryDate?: string | Date
  clientDetails?: {
    name?: string
    country?: string
    address?: string
  }
  companyDetails?: {
    country?: string
  }
}

export type IssuedDocumentKind = "invoice" | "receipt" | "deliveryNote"

function toValidDate(dateValue: string | Date | undefined): Date {
  const date = dateValue ? new Date(dateValue) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function extractOrderNumber(value: string | undefined): string {
  if (!value) {
    return "000"
  }

  const numericParts = value.match(/\d+/g)
  if (!numericParts || numericParts.length === 0) {
    return "000"
  }

  return numericParts[numericParts.length - 1].padStart(3, "0")
}


function sanitizeClientName(name: string | undefined): string {
  if (!name) {
    return "UnknownClient"
  }

  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const safeName = normalized.replace(/[^a-zA-Z0-9]+/g, "")
  return safeName || "UnknownClient"
}

function issuedKindLabel(kind: IssuedDocumentKind): "INVOICE" | "RECEIPT" | "DELIVERY_NOTE" {
  if (kind === "invoice") return "INVOICE"
  if (kind === "receipt") return "RECEIPT"
  return "DELIVERY_NOTE"
}

/** Zero-pads a sequence number to 3 digits: 1 → "001", 42 → "042". */
function padSequence(n: string | number): string {
  return String(n).padStart(3, "0")
}

/**
 * Issued PDFs (sales invoice, receipt, delivery note):
 * `{year}_Q{q}_Eingang_{order}_{Client}_{KIND}_{CC}_{dd.MM.yyyy}.pdf`.
 * Year, quarter, and date come only from `invoiceDate` / `receiptDate` / `deliveryDate` (per kind), not from mixed fallbacks.
 */
export function buildDocumentFilename(document: DocumentData, kind: IssuedDocumentKind): string {
  const rawDate =
    kind === "invoice"
      ? document.invoiceDate
      : kind === "receipt"
        ? document.receiptDate
        : document.deliveryDate

  const d = toValidDate(rawDate)
  const year = d.getFullYear()
  const q = Math.floor(d.getMonth() / 3) + 1
  const clientSeg = sanitizeClientName(document.clientDetails?.name)
  const cc = resolveCountryCodeForFilename(document.clientDetails, document.companyDetails)
  const dateStr = format(d, "dd.MM.yyyy")
  const kindSeg = issuedKindLabel(kind)

  const numKey =
    kind === "invoice"
      ? document.invoiceNumber
      : kind === "receipt"
        ? document.receiptNumber
        : document.deliveryNoteNumber
  const order = extractOrderNumber(numKey)

  return `${year}_Q${q}_Eingang_${order}_${clientSeg}_${kindSeg}_${cc}_${dateStr}.pdf`
}

/** Cost / supplier bills: `billDate` drives year, quarter, and date in Ausgabe names. */
export type CostFilenameDateInput = {
  billDate?: string | Date | undefined
}

/** Lowercase kind labels used in Ausgabe filenames (e.g. `invoice`, `receipt`). */
export type CostAusgabeKind = "invoice" | "receipt" | "credit_note" | "bank_proof" | "driving"

/**
 * Cost bill filenames:
 * `{year}_Q{q}_Ausgabe_{seq}_{Merchant}_{kind}_{CC}_{dd.MM.yyyy}` (plus extension).
 * `sequenceNumber` should be a zero-padded global per-user counter (e.g. `"001"`).
 */
function buildCostAusgabeStem(
  params: CostFilenameDateInput & {
    merchant: string
    countryCode?: string | null
    kind: CostAusgabeKind
    /**
     * Global per-user sequence number for this cost item (e.g. `"001"`, `42`).
     * Will be zero-padded to at least 3 digits.
     */
    sequenceNumber: string | number
  },
): string {
  const d = toValidDate(params.billDate)
  const year = d.getFullYear()
  const q = Math.floor(d.getMonth() / 3) + 1
  const order = padSequence(params.sequenceNumber)
  const merchant = sanitizeClientName(params.merchant)
  const cc = (params.countryCode || "XX").toString().slice(0, 2).toUpperCase() || "XX"
  const dateStr = format(d, "dd.MM.yyyy")
  return `${year}_Q${q}_Ausgabe_${order}_${merchant}_${params.kind}_${cc}_${dateStr}`
}

function extFromOriginalName(name: string): string {
  const i = name.lastIndexOf(".")
  if (i >= 0) return name.slice(i).toLowerCase()
  return ""
}

/** Uploaded cost file: `{year}_Q{q}_Ausgabe_{seq}_{Merchant}_{kind}_{CC}_{date}{ext}`. */
export function buildCostAusgabeUploadedFilename(
  params: CostFilenameDateInput & {
    merchant: string
    countryCode?: string | null
    kind: CostAusgabeKind
    originalFileName: string
    /** Global per-user sequence number (e.g. `"001"`, `42`). Zero-padded to 3 digits. */
    sequenceNumber: string | number
  },
): string {
  const ext = extFromOriginalName(params.originalFileName) || ".bin"
  const stem = buildCostAusgabeStem(params)
  return `${stem}${ext}`
}
