/**
 * FX row from Firestore only: BMF monthly import `exchange_rates/{userId}_bmf_{year}.ratesByMonth[yyyy-MM]`.
 */

import type { Firestore } from "firebase/firestore"
import { fetchBmfMonthRatesRow } from "@/lib/bmf-month-rates-client"
import { mergeFxRateRows, type EurReferenceRates } from "@/lib/eur-rates"

/** When BMF has no row for the month: only EUR (no invented cross-rates). */
function euroOnlyRow(): EurReferenceRates {
  return { EUR: 1 }
}

export async function buildFxRateRowFromFirestore(params: {
  db: Firestore
  userId: string
  monthKey: string | null
}): Promise<EurReferenceRates> {
  if (!params.monthKey) {
    return euroOnlyRow()
  }
  const bmf = await fetchBmfMonthRatesRow(params.db, params.userId, params.monthKey)
  if (!bmf) {
    return euroOnlyRow()
  }
  return mergeFxRateRows(euroOnlyRow(), bmf)
}
