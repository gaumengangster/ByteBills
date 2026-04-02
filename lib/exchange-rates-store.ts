/**
 * Firestore `exchange_rates` collection:
 * - BMF CSV import (per user): document id `{userId}_bmf_{yyyy}` — `ratesByMonth`, etc.
 * - Legacy BMF tree (optional): `yyyy` / `months` / `currencies` — still allowed by rules if present
 */
import { formatInTimeZone } from "date-fns-tz"
import { DOCUMENT_DATE_TIMEZONE } from "@/lib/document-date-berlin"

export const EXCHANGE_RATES_COLLECTION = "exchange_rates"

/** `exchange_rates` document for one user’s BMF CSV import for a calendar year. */
export const BMF_UST_CSV_YEAR_KIND = "bmf_ust_csv_year"

/** e.g. `uid_bmf_2026` */
export function bmfUstCsvYearDocId(userId: string, year: number): string {
  return `${userId}_bmf_${year}`
}

/** Legacy subcollections under `exchange_rates/{yyyy}` (older sync shape). */
export const BMF_UST_MONTHS_SUBCOLLECTION = "months"
export const BMF_UST_CURRENCIES_SUBCOLLECTION = "currencies"

export function isBmfUstYearDocId(docId: string): boolean {
  return /^\d{4}$/.test(docId)
}

/** Current calendar month `yyyy-MM` in Europe/Berlin (same basis as invoice dates). */
export function calendarMonthKeyNowBerlin(): string {
  return formatInTimeZone(new Date(), DOCUMENT_DATE_TIMEZONE, "yyyy-MM")
}

/** Month keys from `pastMonths` before through `futureMonths` after Berlin “now”, ascending. */
export function monthKeysAroundBerlin(pastMonths: number, futureMonths: number): string[] {
  const currentKey = calendarMonthKeyNowBerlin()
  const [ys, ms] = currentKey.split("-")
  let y = parseInt(ys, 10)
  let mo = parseInt(ms, 10)
  const out: string[] = []
  for (let i = -pastMonths; i <= futureMonths; i++) {
    let mm = mo + i
    let yy = y
    while (mm < 1) {
      mm += 12
      yy -= 1
    }
    while (mm > 12) {
      mm -= 12
      yy += 1
    }
    out.push(`${yy}-${String(mm).padStart(2, "0")}`)
  }
  return out
}

/** Month keys for the monthly exchange-rates UI table (Berlin calendar, newest month first). */
export function monthKeysForExchangeRatesTable(pastMonths: number, futureMonths: number): string[] {
  const keys = monthKeysAroundBerlin(pastMonths, futureMonths)
  return [...keys].sort((a, b) => b.localeCompare(a))
}

/** `yyyy-MM-dd` → `yyyy-MM` (calendar month of that Berlin-persisted day). */
export function calendarMonthKeyFromYmd(ymd: string): string | null {
  const s = ymd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s.slice(0, 7)
}
