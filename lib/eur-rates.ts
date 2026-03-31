/**
 * ECB euro foreign exchange reference rates (same figures as the official table):
 * https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
 *
 * For reporting, conversions use the rate set for the document's **business date**
 * (invoice date / receipt date), not today's rate — see `eurofxref-hist.xml`.
 *
 * Machine-readable feeds: units of each currency per 1 EUR (ECB convention).
 * Convert to EUR: amountInCurrency / rates[currency]
 */

export type EurReferenceRates = Record<string, number>

/** Full history: one block per calendar day with ECB rates (used for invoice-date conversion). */
export const ECB_EUROFXREF_HIST_XML =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml"

/** Used when the live feed fails (approximate; EUR/USD/GBP/CZK match typical app usage). */
export const FALLBACK_EUR_RATES: EurReferenceRates = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.84,
  CZK: 24.5,
}

/** Per calendar day (yyyy-MM-dd): merged ECB rates applicable to documents dated that day. */
export type EurRatesByDocumentDate = Record<string, EurReferenceRates>

/** Parsed full ECB history (per server instance). Refetched only when missing or possibly stale — see `ensureEcbXmlForDocumentDates`. */
let ecbParsedHist: {
  byDate: Record<string, EurReferenceRates>
  sortedKeys: string[]
} | null = null

/** Resolved rates for a document business date (yyyy-MM-dd); avoids recomputing and skips XML fetch on repeat. */
const resolvedRatesByDocDate = new Map<string, EurReferenceRates>()

/** UTC yyyy-MM-dd of last successful ECB XML fetch (caps refresh attempts when newer ECB days may exist). */
let lastEcbXmlFetchUtcDay: string | null = null

function utcTodayYmd(): string {
  const n = new Date()
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`
}

function normalizeCurrency(c: string | undefined): string {
  if (typeof c === "string" && /^[A-Za-z]{3}$/.test(c.trim())) {
    return c.trim().toUpperCase()
  }
  return "EUR"
}

/** Parses one day's inner XML fragment (`<Cube currency='…' rate='…'/>`). */
export function parseEcbEurofxrefDailyXml(xml: string): Record<string, number> {
  const rates: Record<string, number> = {}
  const re = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    rates[m[1]] = parseFloat(m[2])
  }
  return rates
}

/**
 * Parses ECB `eurofxref-hist.xml`: outer `<Cube time="YYYY-MM-DD">` blocks.
 */
export function parseEcbEurofxrefHistXml(xml: string): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  const dayRe = /<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g
  let m: RegExpExecArray | null
  while ((m = dayRe.exec(xml)) !== null) {
    const day = m[1]
    const inner = m[2]
    out[day] = parseEcbEurofxrefDailyXml(inner)
  }
  return out
}

export function mergeEcbLiveRates(live: Record<string, number>): EurReferenceRates {
  return { ...FALLBACK_EUR_RATES, ...live, EUR: 1 }
}

function findRightmostDateLeq(sortedAsc: string[], dateKey: string): number {
  let lo = 0
  let hi = sortedAsc.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sortedAsc[mid] <= dateKey) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/**
 * ECB publishes working-day rates; weekends/holidays use the latest prior ECB date ≤ document date.
 * Dates before the first ECB entry use the earliest available row; dates after the last use the latest.
 */
export function resolveRatesForCalendarDate(
  sortedEcbDateKeys: string[],
  ratesByEcbDate: Record<string, EurReferenceRates>,
  calendarDateKey: string,
): EurReferenceRates {
  if (sortedEcbDateKeys.length === 0) {
    return mergeEcbLiveRates({})
  }
  const exact = ratesByEcbDate[calendarDateKey]
  if (exact) {
    return exact
  }
  const idx = findRightmostDateLeq(sortedEcbDateKeys, calendarDateKey)
  if (idx >= 0) {
    return ratesByEcbDate[sortedEcbDateKeys[idx]]
  }
  if (calendarDateKey < sortedEcbDateKeys[0]) {
    return ratesByEcbDate[sortedEcbDateKeys[0]]
  }
  const last = sortedEcbDateKeys[sortedEcbDateKeys.length - 1]
  return ratesByEcbDate[last]
}

async function fetchAndParseEcbXml(): Promise<void> {
  const res = await fetch(ECB_EUROFXREF_HIST_XML, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(String(res.status))
  }
  const xml = await res.text()
  const raw = parseEcbEurofxrefHistXml(xml)
  const sortedKeys = Object.keys(raw).sort()
  const byDate: Record<string, EurReferenceRates> = {}
  for (const k of sortedKeys) {
    byDate[k] = mergeEcbLiveRates(raw[k])
  }
  ecbParsedHist = { byDate, sortedKeys }
  lastEcbXmlFetchUtcDay = utcTodayYmd()
  resolvedRatesByDocDate.clear()
}

/**
 * Ensures ECB `eurofxref-hist.xml` is loaded when needed, and caches the **resolved** rate row
 * for each requested document date. Refetches XML only when:
 * - no parsed history yet, or
 * - a requested date is **after** the latest ECB date in our snapshot **and** ECB may have
 *   published newer rows (`last < today`), at most once per UTC calendar day.
 * Repeat requests for the same document date reuse the cached resolution (no ECB fetch).
 */
async function ensureEcbXmlForDocumentDates(dateKeys: string[]): Promise<void> {
  const keys = [...new Set(dateKeys)].filter(Boolean).sort()
  if (keys.length === 0) return

  const missing = keys.filter((d) => !resolvedRatesByDocDate.has(d))
  if (missing.length === 0) return

  const today = utcTodayYmd()
  const lastEcb = ecbParsedHist?.sortedKeys[ecbParsedHist.sortedKeys.length - 1]
  const maxMissing = missing.reduce((a, b) => (a > b ? a : b))

  let needFetch =
    !ecbParsedHist ||
    (!!lastEcb && lastEcb < today && maxMissing > lastEcb && lastEcbXmlFetchUtcDay !== today)

  if (needFetch) {
    await fetchAndParseEcbXml()
  }

  if (!ecbParsedHist) {
    throw new Error("ECB history unavailable")
  }

  const { sortedKeys, byDate } = ecbParsedHist
  for (const d of missing) {
    if (!resolvedRatesByDocDate.has(d)) {
      const r = resolveRatesForCalendarDate(sortedKeys, byDate, d)
      resolvedRatesByDocDate.set(d, r)
    }
  }
}

/**
 * Resolved ECB rates for each document business date (yyyy-MM-dd). Used by `/api/eur-rates/by-dates`
 * and server-side saves.
 */
export async function resolveEcbRatesForDocumentDates(
  calendarDateKeys: string[],
): Promise<EurRatesByDocumentDate> {
  const unique = [...new Set(calendarDateKeys)].filter(Boolean).sort()
  if (unique.length === 0) {
    return {}
  }
  await ensureEcbXmlForDocumentDates(unique)
  const out: EurRatesByDocumentDate = {}
  for (const d of unique) {
    out[d] = resolvedRatesByDocDate.get(d) ?? mergeEcbLiveRates({})
  }
  return out
}

/**
 * Resolves ECB rates per document business date (`yyyy-MM-dd`) for saving invoices, receipts,
 * and cost bills. Browser calls `/api/eur-rates/by-dates`, which uses the same per-date cache.
 */
export async function fetchEurRatesForDocumentDates(
  calendarDateKeys: string[],
): Promise<EurRatesByDocumentDate> {
  const unique = [...new Set(calendarDateKeys)].filter(Boolean).sort()
  if (unique.length === 0) {
    return {}
  }

  try {
    if (typeof window !== "undefined") {
      const res = await fetch("/api/eur-rates/by-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: unique }),
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(String(res.status))
      }
      const data = (await res.json()) as { rates?: EurRatesByDocumentDate }
      return data.rates ?? {}
    }

    return resolveEcbRatesForDocumentDates(unique)
  } catch (e) {
    console.warn("ECB historical rates unavailable, using fallback per document", e)
    const fb = mergeEcbLiveRates({})
    const out: EurRatesByDocumentDate = {}
    for (const d of unique) {
      out[d] = fb
    }
    return out
  }
}

export function convertAmountToEur(
  amount: number,
  currency: string | undefined,
  rates: EurReferenceRates,
): number {
  const v = Number(amount)
  if (!Number.isFinite(v)) {
    return 0
  }
  const c = normalizeCurrency(currency)
  if (c === "EUR") {
    return v
  }
  const unitsPerEur = rates[c]
  if (unitsPerEur == null || !Number.isFinite(unitsPerEur) || unitsPerEur <= 0) {
    return v
  }
  return v / unitsPerEur
}
