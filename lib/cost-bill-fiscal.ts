/** Calendar-year fiscal metadata derived from supplier bill date (`yyyy-MM-dd`). */

export type FiscalYearQuarter = {
  fiscalYear: number
  fiscalQuarter: 1 | 2 | 3 | 4
}

export function fiscalYearAndQuarterFromYmd(ymd: string): FiscalYearQuarter | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(y) || !Number.isFinite(month)) return null
  const q = Math.floor((month - 1) / 3) + 1
  return { fiscalYear: y, fiscalQuarter: Math.min(4, Math.max(1, q)) as 1 | 2 | 3 | 4 }
}
