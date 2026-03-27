/** ISO 4217 for chart formatting (matches invoice/receipt `currency` fields). */
function normalizeCurrencyCode(c: string | undefined): string {
  if (typeof c === "string" && /^[A-Za-z]{3}$/.test(c.trim())) {
    return c.trim().toUpperCase()
  }
  return "EUR"
}

/**
 * Pick display currency from invoices/receipts by majority count (ties → EUR).
 */
export function getRevenueDisplayCurrency(documents: { currency?: string }[]): string {
  const codes = documents
    .map((d) =>
      typeof d.currency === "string" && d.currency.trim() ? normalizeCurrencyCode(d.currency) : null,
    )
    .filter((c): c is string => c !== null)
  if (codes.length === 0) {
    return "EUR"
  }
  const tally = new Map<string, number>()
  for (const c of codes) {
    tally.set(c, (tally.get(c) || 0) + 1)
  }
  let best = "EUR"
  let max = 0
  for (const [c, n] of tally) {
    if (n > max) {
      max = n
      best = c
    }
  }
  return best
}

/** Compact axis/label amounts (e.g. €5K, $10K, 12 Kč). */
export function formatCurrencyAxisCompact(value: number, currency: string = "EUR"): string {
  const v = Number(value)
  if (!Number.isFinite(v)) {
    return ""
  }
  const cur = normalizeCurrencyCode(currency)
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v)
  } catch {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      }).format(v)
    } catch {
      return String(v)
    }
  }
}

/** Full tooltip / detail amounts. */
export function formatRevenueFull(value: number, currency: string): string {
  const cur = normalizeCurrencyCode(currency)
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Tick steps: $5k up to $50k max, $10k up to $200k, coarser steps beyond (keeps ≤ ~12 ticks). */
export function buildRevenueYTicks(maxValue: number): number[] {
  const max = Math.max(0, Number(maxValue) || 0)
  const padded = max * 1.05
  let step = 5000
  if (max > 50_000) step = 10_000
  if (max > 200_000) step = 50_000
  if (max > 1_000_000) step = 100_000
  const top = Math.max(step, Math.ceil(padded / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) {
    ticks.push(Math.round(v))
  }
  return ticks
}
