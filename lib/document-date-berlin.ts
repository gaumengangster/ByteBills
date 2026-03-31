/**
 * Issued documents (invoices, receipts, delivery notes) use business calendar dates in Europe/Berlin
 * (CET/CEST). Storing `toISOString()` shifted instants by timezone; we persist `yyyy-MM-dd` in Berlin
 * and format with {@link formatInTimeZone}.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

export const DOCUMENT_DATE_TIMEZONE = "Europe/Berlin"

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/

function coerceToDate(value: unknown): Date {
  if (value == null) {
    return new Date(NaN)
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate()
  }
  const s = String(value).trim()
  if (YMD_ONLY.test(s)) {
    return fromZonedTime(`${s}T00:00:00`, DOCUMENT_DATE_TIMEZONE)
  }
  return new Date(s)
}

/** Persist a picked calendar date as Berlin `yyyy-MM-dd` (not UTC `toISOString()`). */
export function persistDocumentDateYmd(date: Date): string {
  return formatInTimeZone(date, DOCUMENT_DATE_TIMEZONE, "yyyy-MM-dd")
}

/** Format any stored invoice/receipt/delivery date for UI/PDF in Europe/Berlin. */
export function formatDocumentDateBerlin(value: unknown, dateFnsPattern: string): string {
  const d = coerceToDate(value)
  if (Number.isNaN(d.getTime())) {
    return "—"
  }
  return formatInTimeZone(d, DOCUMENT_DATE_TIMEZONE, dateFnsPattern)
}

/** Parse Firestore/string/Date for react-hook-form defaultValues (Berlin calendar day). */
export function parseStoredDocumentDate(value: unknown): Date {
  return coerceToDate(value)
}

/** ECB / chart date key — Berlin calendar yyyy-MM-dd. */
export function documentDateKeyBerlin(value: unknown): string | null {
  const d = coerceToDate(value)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  return formatInTimeZone(d, DOCUMENT_DATE_TIMEZONE, "yyyy-MM-dd")
}
