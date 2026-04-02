import { FieldValue } from "firebase-admin/firestore"
import { ingestBmfUstFromPdfUrl } from "@/lib/bmf-ust-rates-ingest"
import { getFirebaseAdminDb } from "@/lib/firebase-admin"

export type BmfUstPersistResult = {
  ok: true
  year: number
  pdfPlainTextLength: number
  monthsWritten: string[]
  totalMonthKeysInDoc: number
}

/** Download PDF, OpenAI extract, merge into `bmfUstRates/{year}`. */
export async function persistBmfUstRatesFromPdfUrl(pdfUrl: string): Promise<BmfUstPersistResult> {
  const { extracted, pdfPlainTextLength } = await ingestBmfUstFromPdfUrl(pdfUrl)
  const db = getFirebaseAdminDb()
  const ref = db.collection("bmfUstRates").doc(String(extracted.year))
  const snap = await ref.get()
  const prev = (snap.data()?.ratesByMonth ?? {}) as Record<string, Record<string, number>>
  const mergedMonths = { ...prev, ...extracted.ratesByMonth }

  await ref.set(
    {
      year: extracted.year,
      sourcePdfUrl: pdfUrl,
      lastIngestedAt: FieldValue.serverTimestamp(),
      ratesByMonth: mergedMonths,
    },
    { merge: true },
  )

  return {
    ok: true,
    year: extracted.year,
    pdfPlainTextLength,
    monthsWritten: Object.keys(extracted.ratesByMonth).sort(),
    totalMonthKeysInDoc: Object.keys(mergedMonths).length,
  }
}
