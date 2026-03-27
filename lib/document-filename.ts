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

export function buildDocumentFilename(document: DocumentData): string {
  const documentDate = toValidDate(document.invoiceDate || document.receiptDate || document.deliveryDate)
  const quarter = `Q${Math.floor(documentDate.getMonth() / 3) + 1}`

  const orderNumber = extractOrderNumber(
    document.invoiceNumber || document.receiptNumber || document.deliveryNoteNumber,
  )
  const clientName = sanitizeClientName(document.clientDetails?.name)
  const countryCode = resolveCountryCodeForFilename(document.clientDetails, document.companyDetails)
  const formattedDate = format(documentDate, "dd.MM.yyyy")

  return `${quarter}_${orderNumber}_${clientName}_${countryCode}_${formattedDate}.pdf`
}
