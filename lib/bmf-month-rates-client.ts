import { doc, getDoc, type Firestore } from "firebase/firestore"
import {
  BMF_UST_CSV_YEAR_KIND,
  bmfUstCsvYearDocId,
  EXCHANGE_RATES_COLLECTION,
} from "@/lib/exchange-rates-store"

/** One month column from `exchange_rates/{userId}_bmf_{year}` → `ratesByMonth[yyyy-MM]`. */
export async function fetchBmfMonthRatesRow(
  db: Firestore,
  userId: string,
  monthKey: string,
): Promise<Record<string, number> | null> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null
  const year = parseInt(monthKey.slice(0, 4), 10)
  if (!Number.isFinite(year)) return null
  const snap = await getDoc(doc(db, EXCHANGE_RATES_COLLECTION, bmfUstCsvYearDocId(userId, year)))
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.kind !== BMF_UST_CSV_YEAR_KIND) return null
  const rb = data.ratesByMonth
  if (rb == null || typeof rb !== "object" || Array.isArray(rb)) return null
  const row = (rb as Record<string, unknown>)[monthKey]
  if (row == null || typeof row !== "object" || Array.isArray(row)) return null
  const out: Record<string, number> = {}
  for (const [code, v] of Object.entries(row as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[String(code).toUpperCase()] = v
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
