import { parseISO } from "date-fns"

/**
 * Date used to bucket revenue in charts: invoices use `invoiceDate`, receipts use `receiptDate`.
 * Does not fall back to `createdAt` — missing dates are invalid and those rows are excluded.
 */
export function getRevenueDocumentDate(doc: {
  type?: string
  invoiceDate?: unknown
  receiptDate?: unknown
  createdAt?: unknown
}): Date {
  if (doc.type === "invoices") {
    return parseUnknownDate(doc.invoiceDate)
  }
  if (doc.type === "receipts") {
    return parseUnknownDate(doc.receiptDate)
  }
  return parseUnknownDate(doc.createdAt)
}

/**
 * Date used to bucket document counts in charts: invoices and proforma use `invoiceDate`,
 * receipts use `receiptDate`, delivery notes use `deliveryDate`.
 * Does not fall back to `createdAt` — missing dates are invalid and those rows are excluded.
 */
export function getDocumentChartDate(doc: {
  type?: string
  invoiceDate?: unknown
  receiptDate?: unknown
  deliveryDate?: unknown
}): Date {
  if (doc.type === "invoices" || doc.type === "proformaInvoices") {
    return parseUnknownDate(doc.invoiceDate)
  }
  if (doc.type === "receipts") {
    return parseUnknownDate(doc.receiptDate)
  }
  if (doc.type === "deliveryNotes") {
    return parseUnknownDate(doc.deliveryDate)
  }
  return new Date(NaN)
}

function parseUnknownDate(value: unknown): Date {
  if (value == null) {
    return new Date(NaN)
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === "string") {
    return parseISO(value)
  }
  return new Date(value as number)
}
