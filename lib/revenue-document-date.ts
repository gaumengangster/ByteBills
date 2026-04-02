import { parseStoredDocumentDate } from "@/lib/document-date-berlin"

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseInvoiceTaxDateOnly(doc: { taxDate?: unknown }): Date {
  const t = doc.taxDate
  if (typeof t === "string" && YMD_ONLY.test(t.trim())) {
    return parseStoredDocumentDate(t.trim().slice(0, 10))
  }
  return new Date(NaN)
}

/**
 * Date used to bucket revenue in charts: invoices use `taxDate` only; receipts use `receiptDate`.
 * Does not fall back to `createdAt` — missing `taxDate` yields invalid date and those rows are excluded.
 */
export function getRevenueDocumentDate(doc: {
  type?: string
  invoiceDate?: unknown
  receiptDate?: unknown
  taxDate?: unknown
}): Date {
  if (doc.type === "invoices") {
    return parseInvoiceTaxDateOnly(doc)
  }
  if (doc.type === "receipts") {
    return parseStoredDocumentDate(doc.receiptDate)
  }
  return new Date(NaN)
}

/**
 * Date used to bucket document counts in charts: invoices use `taxDate` only; proforma uses `invoiceDate`;
 * receipts use `receiptDate`, delivery notes use `deliveryDate`.
 */
export function getDocumentChartDate(doc: {
  type?: string
  invoiceDate?: unknown
  receiptDate?: unknown
  deliveryDate?: unknown
  taxDate?: unknown
}): Date {
  if (doc.type === "invoices") {
    return parseInvoiceTaxDateOnly(doc)
  }
  if (doc.type === "proformaInvoices") {
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
