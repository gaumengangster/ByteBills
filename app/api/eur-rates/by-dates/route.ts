import { NextResponse } from "next/server"
import {
  mergeEcbLiveRates,
  resolveEcbRatesForDocumentDates,
  type EurRatesByDocumentDate,
} from "@/lib/eur-rates"

/** Document-save flows: per-date resolved-rate cache + on-demand ECB XML fetch in `resolveEcbRatesForDocumentDates`. */
export const dynamic = "force-dynamic"

/** Returns merged ECB rates for each requested yyyy-MM-dd (invoice/receipt/bill business date). */
export async function POST(req: Request) {
  let unique: string[] = []
  try {
    const body = (await req.json()) as { dates?: string[] }
    const dates = Array.isArray(body.dates) ? body.dates : []
    unique = [...new Set(dates.map((d) => String(d).trim()).filter(Boolean))]
    if (unique.length === 0) {
      return NextResponse.json({ rates: {} as EurRatesByDocumentDate })
    }

    const rates = await resolveEcbRatesForDocumentDates(unique)
    return NextResponse.json({ rates })
  } catch (e) {
    console.warn("ECB by-dates resolution failed", e)
    const fb = mergeEcbLiveRates({})
    const rates: EurRatesByDocumentDate = {}
    for (const d of unique) {
      rates[d] = fb
    }
    return NextResponse.json({ rates })
  }
}
