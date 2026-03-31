import OpenAI from "openai"
import { extractedBillSchema, type ExtractedBillData } from "@/lib/bill-types"
import { getOpenAiCostsModelDefault } from "@/lib/env-server"

function resolveVisionModel(): string {
  return (
    process.env.OPENAI_COSTS_MODEL ??
    process.env.OPENAI_VISION_MODEL ??
    getOpenAiCostsModelDefault()
  )
}

function resolveTextModel(): string {
  return process.env.OPENAI_COSTS_MODEL ?? process.env.OPENAI_TEXT_MODEL ?? getOpenAiCostsModelDefault()
}

const EXTRACTION_SYSTEM = `You extract structured data from receipts and purchase bills. Return ONLY valid JSON, no markdown, matching this shape:
{
  "billDate": string | null (ISO date YYYY-MM-DD if known),
  "merchant": string | null,
  "invoiceNumber": string | null (supplier invoice or document reference number if shown),
  "merchantCountryCode": string | null (MUST be a 2-letter ISO 3166-1 alpha-2 code ONLY — e.g. "US" for United States, "DE" for Germany, "GB" for United Kingdom, "AU" for Australia, "CA" for Canada, "SG" for Singapore. Never return a full country name. Infer from merchant address, VAT country prefix, phone, or language on the document; null if truly unknown),
  "currency": string | null (3-letter ISO currency code — MUST be non-null whenever any amount has a currency indicator. E.g. "USD" for $ or US$ amounts, "EUR" for € amounts, "GBP" for £ amounts. Use null ONLY when no currency symbol or code of any kind appears on the document),
  "lineItems": [{ "description": string, "quantity"?: number, "unitPrice"?: number, "lineTotal"?: number, "vatRate"?: number }],
  "subtotal": number | null,
  "vatAmount": number | null,
  "total": number | null
}
Currency rules: Always return a 3-letter ISO currency code, never a symbol. Map common symbols to codes: $/US$ -> USD, € -> EUR, £ -> GBP, ¥ -> JPY unless the document clearly indicates CNY, C$ -> CAD, A$ -> AUD, NZ$ -> NZD, S$ -> SGD, HK$ -> HKD, ₹ -> INR, CHF -> CHF. If $ appears next to any amount on a US/American vendor document, return "USD". If only a symbol is shown without explicit country context, infer the most likely ISO code from the merchant country or document context.
Country code rules: Always use the 2-letter alpha-2 code. US = United States/USA, GB = United Kingdom/UK, DE = Germany/Deutschland, AU = Australia, CA = Canada, FR = France, IT = Italy, ES = Spain, NL = Netherlands, CH = Switzerland, SE = Sweden, NO = Norway, JP = Japan, CN = China, SG = Singapore, IN = India.
VAT rules: If the document does not list VAT (no VAT line, no VAT rate, no MwSt/USt/PDV), set "vatAmount" to 0 and omit "vatRate" on line items or use 0 for "vatRate" where a rate would apply. Only use non-zero VAT when the document explicitly shows VAT amounts or rates. If VAT is listed, copy those values accurately.
Use null for other unknown numbers (e.g. subtotal/total) only when they cannot be read. Parse dates from the document language. If text is unreadable, use empty lineItems and nulls.`

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  JP: "JPY",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  SG: "SGD",
  HK: "HKD",
  CN: "CNY",
  IN: "INR",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  RU: "RUB",
  TR: "TRY",
  RS: "RSD",
  UA: "UAH",
}

const CURRENCY_TOKEN_MAP: Record<string, string> = {
  EUR: "EUR",
  EURO: "EUR",
  "€": "EUR",
  USD: "USD",
  US$: "USD",
  "$": "USD",
  GBP: "GBP",
  "£": "GBP",
  CHF: "CHF",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  PLN: "PLN",
  CZK: "CZK",
  HUF: "HUF",
  JPY: "JPY",
  "¥": "JPY",
  CAD: "CAD",
  "C$": "CAD",
  AUD: "AUD",
  "A$": "AUD",
  NZD: "NZD",
  "NZ$": "NZD",
  SGD: "SGD",
  "S$": "SGD",
  HKD: "HKD",
  "HK$": "HKD",
  CNY: "CNY",
  RMB: "CNY",
  INR: "INR",
  "₹": "INR",
  BRL: "BRL",
  "R$": "BRL",
  MXN: "MXN",
  ZAR: "ZAR",
  RUB: "RUB",
  TRY: "TRY",
  RSD: "RSD",
  UAH: "UAH",
}

/** Maps common full country names that models sometimes return instead of ISO codes. */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
  "U.S.": "US",
  "U.S.A.": "US",
  AMERICA: "US",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  "GREAT BRITAIN": "GB",
  ENGLAND: "GB",
  GERMANY: "DE",
  DEUTSCHLAND: "DE",
  AUSTRIA: "AT",
  OSTERREICH: "AT",
  SWITZERLAND: "CH",
  SCHWEIZ: "CH",
  FRANCE: "FR",
  ITALY: "IT",
  SPAIN: "ES",
  NETHERLANDS: "NL",
  AUSTRALIA: "AU",
  CANADA: "CA",
  JAPAN: "JP",
  CHINA: "CN",
  INDIA: "IN",
  SINGAPORE: "SG",
  "HONG KONG": "HK",
  "SOUTH KOREA": "KR",
  KOREA: "KR",
  BRAZIL: "BR",
  MEXICO: "MX",
  RUSSIA: "RU",
  TURKEY: "TR",
  SERBIA: "RS",
  UKRAINE: "UA",
  SWEDEN: "SE",
  NORWAY: "NO",
  DENMARK: "DK",
  FINLAND: "FI",
  POLAND: "PL",
  "CZECH REPUBLIC": "CZ",
  CZECHIA: "CZ",
  HUNGARY: "HU",
  "NEW ZEALAND": "NZ",
}

/** Normalises a raw merchant country code value (which might be a full name or abbreviated) to a 2-letter ISO code. */
function normalizeCountryCode(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return ""
  const upper = raw.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  const fromName = COUNTRY_NAME_TO_ISO[upper]
  if (fromName) return fromName
  // 3-letter codes like "USA" — try first 2 chars as a fallback
  if (/^[A-Z]{3}$/.test(upper) && COUNTRY_DEFAULT_CURRENCY[upper.slice(0, 2)]) return upper.slice(0, 2)
  return ""
}

function normalizeCurrencyValue(rawCurrency: unknown, merchantCountryCode: unknown): string | null {
  const cc = normalizeCountryCode(merchantCountryCode)
  const countryDefault = cc ? (COUNTRY_DEFAULT_CURRENCY[cc] ?? null) : null

  const token = typeof rawCurrency === "string" ? rawCurrency.trim().toUpperCase() : ""
  if (token) {
    const mapped = CURRENCY_TOKEN_MAP[token]
    if (mapped) {
      // If the model defaulted to EUR but the merchant country uses a known non-EUR currency, trust the country.
      if (mapped === "EUR" && countryDefault) return countryDefault
      return mapped
    }
    if (/^[A-Z]{3}$/.test(token)) return token
  }
  return countryDefault
}

function parseJsonResponse(content: string): ExtractedBillData {
  const trimmed = content.trim()
  const jsonStr = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed
  const raw = JSON.parse(jsonStr) as Record<string, unknown>
  const normalized = {
    ...raw,
    currency: normalizeCurrencyValue(raw.currency, raw.merchantCountryCode),
  }
  return extractedBillSchema.parse(normalized)
}

export async function extractBillFromImageBase64(
  base64: string,
  mimeType: string
): Promise<ExtractedBillData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  const client = new OpenAI({ apiKey })
  const model = resolveVisionModel()

  const response = await client.chat.completions.create({
    model,
    max_tokens: 3072,
    temperature: 0,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all purchasable line items, totals, VAT, merchant, and bill date from this image.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("No content from vision model")
  }
  return parseJsonResponse(content)
}

export async function extractBillFromText(text: string): Promise<ExtractedBillData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  const client = new OpenAI({ apiKey })
  const model = resolveTextModel()

  const response = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    temperature: 0,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      {
        role: "user",
        content: `Extract structured data from this bill/receipt text:\n\n${text.slice(0, 120_000)}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("No content from text model")
  }
  return parseJsonResponse(content)
}
