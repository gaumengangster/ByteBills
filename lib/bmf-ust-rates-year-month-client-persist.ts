import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore"
import { parseBmfUstCsv } from "@/lib/bmf-ust-rates-csv"
import {
  BMF_UST_CSV_YEAR_KIND,
  bmfUstCsvYearDocId,
  EXCHANGE_RATES_COLLECTION,
} from "@/lib/exchange-rates-store"

export type BmfUstClientPersistResult = {
  monthsWritten: string[]
  currencyRowCount: number
  csvBytes: number
}

function countCurrencyRows(ratesByMonth: Record<string, Record<string, number>>): number {
  let n = 0
  for (const row of Object.values(ratesByMonth)) {
    n += Object.keys(row).length
  }
  return n
}

/**
 * Parse BMF CSV text and save one Firestore document (like an invoice): `exchange_rates/{userId}_bmf_{year}`
 * with `userId`, `ratesByMonth`, ISO `createdAt` / `updatedAt`, and metadata.
 */
export async function persistBmfUstCsvTextToYearMonthTreeClient(
  firestore: Firestore,
  userId: string,
  input: { year: number; csvText: string; sourceCsvUrl: string; csvBytes: number },
): Promise<BmfUstClientPersistResult> {
  const { year, csvText, sourceCsvUrl, csvBytes } = input
  if (!userId.trim()) {
    throw new Error("Missing user id")
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year")
  }

  const { ratesByMonth } = parseBmfUstCsv(csvText, year)
  const monthKeys = Object.keys(ratesByMonth).sort()
  if (monthKeys.length === 0) {
    throw new Error("No month columns with rates found in CSV")
  }

  const ref = doc(firestore, EXCHANGE_RATES_COLLECTION, bmfUstCsvYearDocId(userId, year))
  const snap = await getDoc(ref)
  const prev = snap.exists() ? snap.data() : null
  const nowIso = new Date().toISOString()
  const createdAt = typeof prev?.createdAt === "string" ? prev.createdAt : nowIso

  await setDoc(
    ref,
    {
      userId,
      kind: BMF_UST_CSV_YEAR_KIND,
      year,
      sourceCsvUrl,
      ratesByMonth,
      csvBytes,
      createdAt,
      updatedAt: nowIso,
    },
    { merge: true },
  )

  return {
    monthsWritten: monthKeys,
    currencyRowCount: countCurrencyRows(ratesByMonth),
    csvBytes,
  }
}
