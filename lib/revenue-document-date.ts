import { parseStoredDocumentDate } from "@/lib/document-date-berlin"

/**
 * Date used to bucket revenue in charts: invoices use `invoiceDate`, receipts use `receiptDate`.
 * Does not fall back to `createdAt` — missing dates are invalid and those rows are excluded.
 */
export function getRevenueDocumentDate(doc: {
  type?: string
  invoiceDate?: unknown
  receiptDate?: unknown
}): Date {
  if (doc.type === "invoices") {
    return parseStoredDocumentDate(doc.invoiceDate)
  }
  if (doc.type === "receipts") {
    return parseStoredDocumentDate(doc.receiptDate)
  }
  return new Date(NaN)
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
    return parseStoredDocumentDate(doc.invoiceDate)
  }
  if (doc.type === "receipts") {
    return parseStoredDocumentDate(doc.receiptDate)
  }
  if (doc.type === "deliveryNotes") {
    return parseStoredDocumentDate(doc.deliveryDate)
  }
  return new Date(NaN)
}
