import { NextResponse } from "next/server"
import { resolveEcbRatesForDocumentDates, type EurRatesByDocumentDate } from "@/lib/eur-rates"

export const dynamic = "force-dynamic"

function utcYmdDaysBack(count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    out.push(`${y}-${m}-${day}`)
  }
  return out
}

/** Last N calendar days (UTC), newest first. Same ECB resolution as document saves. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = parseInt(url.searchParams.get("days") || "14", 10)
  const days = Number.isFinite(raw) ? Math.min(90, Math.max(1, raw)) : 14
  const dateKeys = utcYmdDaysBack(days)
  const rates = await resolveEcbRatesForDocumentDates(dateKeys)
  const ordered: EurRatesByDocumentDate = {}
  for (const d of dateKeys) {
    ordered[d] = rates[d] ?? {}
  }
  return NextResponse.json({ dates: dateKeys, rates: ordered })
}
