/** ISO 3166-1 alpha-2 resolution for client address / country fields. */

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  serbia: "RS",
  srbija: "RS",
  austria: "AT",
  osterreich: "AT",
  schweiz: "CH",
  switzerland: "CH",
  czechia: "CZ",
  "czech republic": "CZ",
  "ceska republika": "CZ",
  praha: "CZ",
  prague: "CZ",
  france: "FR",
  frankreich: "FR",
  spain: "ES",
  espana: "ES",
  españa: "ES",
  italy: "IT",
  italia: "IT",
  netherlands: "NL",
  nederland: "NL",
  "the netherlands": "NL",
  belgium: "BE",
  belgien: "BE",
  belgie: "BE",
  poland: "PL",
  polska: "PL",
  sweden: "SE",
  sverige: "SE",
  denmark: "DK",
  danmark: "DK",
  finland: "FI",
  suomi: "FI",
  ireland: "IE",
  portugal: "PT",
  greece: "GR",
  hellas: "GR",
  hungary: "HU",
  magyarorszag: "HU",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  hrvatska: "HR",
  slovakia: "SK",
  slovenia: "SI",
  slovenija: "SI",
  lithuania: "LT",
  latvia: "LV",
  estonia: "EE",
  luxembourg: "LU",
  luxemburg: "LU",
  malta: "MT",
  cyprus: "CY",
  kibris: "CY",
}

/** EU member states (27), ISO alpha-2. */
const EU_MEMBER_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
])

export function normalizeCountryCode(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const t = value.trim()
  // ISO alpha-2: only accept uniform case (DE, de), not mixed "Na" (Czech "on the" → Namibia "NA").
  if (t.length !== 2 || !/^[A-Za-z]{2}$/.test(t)) {
    return null
  }
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) {
    return null
  }
  return t.toUpperCase()
}

function normalizeCountryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function countryCodeFromValue(value: string | undefined): string | null {
  const directCode = normalizeCountryCode(value)
  if (directCode) {
    return directCode
  }

  if (!value) {
    return null
  }

  const normalizedName = normalizeCountryName(value)
  return COUNTRY_NAME_TO_CODE[normalizedName] || null
}

function stripAccentsLower(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Czech addresses often omit the country line; infer CZ from postcode + city/district/street patterns.
 * e.g. "Na Strži ... 140 00 Prah 4 -Krč" → Prague area.
 */
function inferCzechRepublicFromAddress(address: string): string | null {
  const t = stripAccentsLower(address)

  if (/\b(czechia|czech republic|ceska republika)\b/.test(t)) {
    return "CZ"
  }
  if (/\b(praha|prague)\b/.test(t)) {
    return "CZ"
  }
  // Common typo for "Praha" (e.g. "140 00 Prah 4")
  if (/\bprah\s+\d/.test(t)) {
    return "CZ"
  }
  // Distinctive Czech street form
  if (/\bna strzi\b/.test(t)) {
    return "CZ"
  }
  // Krč / Krč = Prague district; with Czech-style postcode (NNN NN)
  if (/\bkrc\b/.test(t) && /\b\d{3}\s*\d{2}\b/.test(t)) {
    return "CZ"
  }

  return null
}

export function extractCountryFromAddress(address: string | undefined): string | null {
  if (!address) {
    return null
  }

  const lines = address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const lastLine = lines.length > 0 ? lines[lines.length - 1] : null
  const codeFromLastLine = countryCodeFromValue(lastLine || undefined)
  if (codeFromLastLine) {
    return codeFromLastLine
  }

  const chunks = address.split(/[\s,]+/).filter(Boolean)
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const possibleCode = countryCodeFromValue(chunks[i])
    if (possibleCode) {
      return possibleCode
    }
  }

  return inferCzechRepublicFromAddress(address)
}

type ClientDetailsLike = {
  country?: string
  address?: string
}

/** Client country only (no company fallback). */
export function resolveClientCountryCode(clientDetails?: ClientDetailsLike): string | null {
  return (
    countryCodeFromValue(clientDetails?.country) ||
    extractCountryFromAddress(clientDetails?.address) ||
    null
  )
}

type CompanyDetailsLike = { country?: string }

/** Country for PDF filename: client first, then company, else XX. */
export function resolveCountryCodeForFilename(
  clientDetails?: ClientDetailsLike,
  companyDetails?: CompanyDetailsLike,
): string {
  return (
    countryCodeFromValue(clientDetails?.country) ||
    extractCountryFromAddress(clientDetails?.address) ||
    countryCodeFromValue(companyDetails?.country) ||
    "XX"
  )
}

export function isEuMemberState(code: string | null): boolean {
  return code !== null && EU_MEMBER_CODES.has(code)
}

/** EU B2B reverse charge: recipient in another EU member state (not Germany). */
export function isEuMemberExceptGermany(code: string | null): boolean {
  if (!code || code === "DE") {
    return false
  }
  return EU_MEMBER_CODES.has(code)
}
