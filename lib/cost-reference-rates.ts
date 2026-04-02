/**
 * Cost expense dates: BMF month row from Firestore (`buildFxRateRowFromFirestore`).
 */

import type { Firestore } from "firebase/firestore"
import { calendarMonthKeyFromYmd } from "@/lib/exchange-rates-store"
import { buildFxRateRowFromFirestore } from "@/lib/firestore-fx-rate-row"
import type { EurReferenceRates } from "@/lib/eur-rates"

export async function resolveReferenceRatesForCostExpenseDate(params: {
  db: Firestore
  userId: string
  expenseDateYmd: string
  currency: string
}): Promise<{ rates: EurReferenceRates; monthKey: string | null }> {
  const monthKey = calendarMonthKeyFromYmd(params.expenseDateYmd.trim())
  const rates = await buildFxRateRowFromFirestore({
    db: params.db,
    userId: params.userId,
    monthKey,
  })
  return { rates, monthKey }
}

/** Units of `currency` per 1 EUR (divide foreign amount by this for EUR). */
export function unitsPerEurForCurrencyFromRow(rates: EurReferenceRates, currency: string): number | null {
  const c = currency.trim().toUpperCase()
  if (c === "EUR") return null
  const u = rates[c]
  if (u == null || !Number.isFinite(u) || u <= 0) return null
  return u
}
