import { z } from "zod"

/** One line on a cost bill / receipt. */
export const billLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  lineTotal: z.number().optional(),
  vatRate: z.number().optional(),
})

export type BillLineItem = z.infer<typeof billLineItemSchema>

/** Result from OCR / LLM extraction (before user edits). */
export const extractedBillSchema = z.object({
  /** May be missing from extraction; UI defaults to today before save. */
  billDate: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  /** Supplier invoice / reference number if shown on the document. */
  invoiceNumber: z.string().nullable().optional(),
  /** ISO 3166-1 alpha-2 country of merchant/supplier (from address, VAT ID, or text). */
  merchantCountryCode: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  lineItems: z.array(billLineItemSchema).default([]),
  subtotal: z.number().nullable().optional(),
  vatAmount: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
})

export type ExtractedBillData = z.infer<typeof extractedBillSchema>

/** Stored on Firestore `bills` for supplier costs. `manual` = no attachment (e.g. home office, mileage log). Persisted `billDate` is always `yyyy-MM-dd` (never null). */
export type CostExpenseDocumentType =
  | "invoice"
  | "receipt"
  | "credit_note"
  | "bank_proof"
  | "driving"
  | "manual"

/** When `expenseDocumentType` is `manual`: home office vs driving (no document). */
export type ManualExpenseKind = "home_office" | "driving"

/** When `manualExpenseKind` is `home_office`. */
export type HomeOfficeCategory = "flat_rate" | "office_supplies" | "utilities" | "communication" | "other"

/** Optional persisted FX conversions at save time (`bills`). Reporting prefers these when set. */
export type CostBillEurFields = {
  /** Net in document currency → EUR (same as `netEur`). */
  subtotalEur: number | null
  vatAmountEur: number | null
  /** Gross in document currency → EUR (same as `grossEur`). */
  totalEur: number | null
  /** Net EUR (duplicate of subtotalEur for exports / clarity). */
  netEur: number | null
  /** Gross EUR (duplicate of totalEur). */
  grossEur: number | null
  /** yyyy-MM-dd — rate row used for conversion */
  eurRateDate: string | null
}

/** Optional fields on Firestore `bills` after Google Drive upload (costs). */
export type CostBillDriveFields = {
  driveInvoiceName: string | null
  driveInvoiceFileId: string | null
  driveReceiptName: string | null
  driveReceiptFileId: string | null
}

/** FX snapshot at save for issued `invoices` / `sales receipts` (rate date = invoice / receipt date). */
export type IssuedRevenueDocumentEurFields = {
  subtotalEur: number
  taxEur: number
  totalEur: number
  eurRateDate: string | null
  /** Units of document currency per 1 EUR (same rate for subtotal and VAT EUR). */
  exchangeRateToEur?: number
}

/** Optional fields on Firestore `invoices` / `receipts` after uploading the PDF to Google Drive. */
export type IssuedPdfDriveFields = {
  drivePdfName: string | null
  drivePdfFileId: string | null
  /** Set to true after a successful in-app upload; prevents duplicate Drive files. */
  uploadedToDrive?: boolean
}

/** Firestore `invoices` document id when this receipt was created from that invoice. */
export type ReceiptInvoiceLink = {
  invoiceRef: string | null
}
