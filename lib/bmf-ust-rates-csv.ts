/**
 * Parse BMF "Umsatzsteuer-Umrechnungskurse" semicolon CSV (ISO-8859-1 / Latin-1).
 * Each cell: units of foreign currency per 1 EUR, e.g. "1,7304 AUD".
 */

const MONTH_PREFIXES: { num: string; prefixes: string[] }[] = [
  { num: "01", prefixes: ["januar"] },
  { num: "02", prefixes: ["februar"] },
  { num: "03", prefixes: ["märz", "maerz", "mrz"] },
  { num: "04", prefixes: ["april"] },
  { num: "05", prefixes: ["mai"] },
  { num: "06", prefixes: ["juni"] },
  { num: "07", prefixes: ["juli"] },
  { num: "08", prefixes: ["august"] },
  { num: "09", prefixes: ["september"] },
  { num: "10", prefixes: ["oktober"] },
  { num: "11", prefixes: ["november"] },
  { num: "12", prefixes: ["dezember"] },
]

export function headerCellToMonthNum(cell: string): string | null {
  const base = cell
    .trim()
    .replace(/\[\d+\]/g, "")
    .trim()
    .toLowerCase()
  for (const { num, prefixes } of MONTH_PREFIXES) {
    for (const p of prefixes) {
      if (base.startsWith(p)) return num
    }
  }
  return null
}

export function parseGermanDecimal(raw: string): number {
  let t = raw.trim().replace(/\s/g, "")
  if (!t) return NaN
  if (t.includes(",") && t.includes(".")) {
    return parseFloat(t.replace(/\./g, "").replace(",", "."))
  }
  if (t.includes(",")) {
    return parseFloat(t.replace(",", "."))
  }
  return parseFloat(t)
}

export function parseCurrencyCell(cell: string): { code: string; value: number } | null {
  const c = cell.trim()
  if (!c) return null
  const m = c.match(/^([\d.,\s]+)\s+([A-Za-z]{3})$/)
  if (!m) return null
  const value = parseGermanDecimal(m[1])
  const code = m[2].toUpperCase()
  if (!Number.isFinite(value) || value <= 0) return null
  if (!/^[A-Z]{3}$/.test(code)) return null
  return { code, value }
}

export type BmfUstCsvParsed = {
  ratesByMonth: Record<string, Record<string, number>>
}

/**
 * @param csvText — decoded as Latin-1 / ISO-8859-1 from the BMF CSV file
 * @param year — calendar year for keys `YYYY-MM`
 */
export function parseBmfUstCsv(csvText: string, year: number): BmfUstCsvParsed {
  const lines = csvText.split(/\r?\n/)
  let headerCols: string[] | null = null
  let monthColIndexToYm: Map<number, string> | null = null

  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.split(";")
    if (cols[0]?.trim().toLowerCase() === "land") {
      headerCols = cols
      const map = new Map<number, string>()
      for (let i = 2; i < cols.length; i++) {
        const mn = headerCellToMonthNum(cols[i] ?? "")
        if (mn) {
          map.set(i, `${year}-${mn}`)
        }
      }
      monthColIndexToYm = map
      break
    }
  }

  if (!headerCols || !monthColIndexToYm || monthColIndexToYm.size === 0) {
    throw new Error("BMF CSV: could not find Land;… header row with month columns")
  }

  const ratesByMonth: Record<string, Record<string, number>> = {}

  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.split(";")
    if (cols[0]?.trim().toLowerCase() === "land") continue
    const land = (cols[0] ?? "").trim()
    if (!land || land.startsWith("[")) continue
    if (land.toLowerCase() === "land") continue

    for (const [colIdx, ym] of monthColIndexToYm) {
      const cell = cols[colIdx] ?? ""
      const parsed = parseCurrencyCell(cell)
      if (!parsed) continue
      if (!ratesByMonth[ym]) ratesByMonth[ym] = {}
      ratesByMonth[ym][parsed.code] = parsed.value
    }
  }

  for (const ym of Object.keys(ratesByMonth)) {
    ratesByMonth[ym].EUR = 1
  }

  return { ratesByMonth }
}

export function defaultBmfUstCsvUrl(year: number): string {
  return `https://www.bundesfinanzministerium.de/Datenportal/Daten/offene-daten/steuern-zoelle/umsatzsteuer-umrechnungskurse/datensaetze/uu-kurse-${year}-csv.csv?__blob=publicationFile&v=6`
}

const ALLOWED_BMF_CSV_HOST = "www.bundesfinanzministerium.de"

/** SSRF-safe CSV URL: default BMF file for `year`, or user URL only on bundesfinanzministerium.de. */
export function resolveAllowedBmfCsvUrl(year: number, csvUrl?: string | null): string {
  if (!csvUrl?.trim()) {
    return defaultBmfUstCsvUrl(year)
  }
  let u: URL
  try {
    u = new URL(csvUrl.trim())
  } catch {
    throw new Error("Invalid CSV URL")
  }
  if (u.protocol !== "https:") {
    throw new Error("CSV URL must use HTTPS")
  }
  if (u.hostname !== ALLOWED_BMF_CSV_HOST) {
    throw new Error("CSV downloads are only allowed from bundesfinanzministerium.de")
  }
  return u.toString()
}
