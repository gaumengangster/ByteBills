/**
 * Download BMF Umsatzsteuer-Umrechnungskurse PDF, extract text, ask OpenAI for structured rates,
 * then persist via Admin SDK (see API route).
 */
import OpenAI from "openai"
import { PDFParse } from "pdf-parse"
import { z } from "zod"
import { getOpenAiCostsModelDefault } from "@/lib/env-server"

const extractedSchema = z.object({
  year: z.number().int(),
  /** Each key is calendar month `YYYY-MM`, values are ISO 4217 code -> units of that currency per 1 EUR */
  ratesByMonth: z.record(z.string(), z.record(z.string(), z.number().positive())),
})

export type BmfUstExtracted = z.infer<typeof extractedSchema>

const SYSTEM = `You convert BMF "Umsatzsteuer-Umrechnungskurse" PDF plain text into JSON.

Rules:
- The table lists "1 Euro" in foreign currency (units of CURRENCY per 1 EUR) — same convention as ECB reference rates for conversion (divide amount in foreign currency by this number to get EUR).
- Column headers are German months: Januar=01, Februar=02, …, Dezember=12 for the SAME calendar year as the document title (e.g. "Übersicht 2026" → year 2026).
- Map each month column to a key "YYYY-MM" (e.g. Januar 2026 → "2026-01").
- Currency codes are 3-letter ISO (e.g. AUD, USD, CZK). Skip rows with no numeric rate (e.g. Rubel suspended).
- German number format: comma is decimal separator, period may be thousands separator (e.g. "19.757,02" → 19757.02). Plain decimals may use comma ("1,7304" → 1.7304).
- Output ONLY valid JSON with this exact shape (no markdown):
{"year": number, "ratesByMonth": { "YYYY-MM": { "CUR": number, ... }, ... }}
- Include "EUR": 1 inside every month object for convenience.
- If a month column is empty for all currencies in the text, omit that month key.
- Do not invent currencies or months; only use what appears in the text.`

export async function downloadBmfUstPdfBuffer(pdfUrl: string): Promise<Buffer> {
  const res = await fetch(pdfUrl, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`PDF fetch failed: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 500) {
    throw new Error("PDF response too small")
  }
  return buf
}

export async function pdfBufferToPlainText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    const text = result.text?.trim() ?? ""
    if (text.length < 200) {
      throw new Error("PDF text extraction yielded almost no text")
    }
    return text
  } finally {
    await parser.destroy()
  }
}

export async function extractBmfUstRatesWithOpenAI(pdfPlainText: string): Promise<BmfUstExtracted> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  const model =
    process.env.OPENAI_BMF_UST_MODEL ??
    process.env.OPENAI_TEXT_MODEL ??
    process.env.OPENAI_COSTS_MODEL ??
    getOpenAiCostsModelDefault()

  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Parse this BMF USt Umrechnungskurse PDF text and return the JSON object:\n\n${pdfPlainText.slice(0, 120_000)}`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) {
    throw new Error("OpenAI returned empty content")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("OpenAI returned non-JSON")
  }

  const upperMonths: Record<string, Record<string, number>> = {}
  const validated = extractedSchema.parse(parsed)
  for (const [ym, rates] of Object.entries(validated.ratesByMonth)) {
    const row: Record<string, number> = {}
    for (const [code, n] of Object.entries(rates)) {
      const c = code.trim().toUpperCase()
      if (/^[A-Z]{3}$/.test(c)) {
        row[c] = n
      }
    }
    row.EUR = 1
    upperMonths[ym] = row
  }
  return { year: validated.year, ratesByMonth: upperMonths }
}

export async function ingestBmfUstFromPdfUrl(pdfUrl: string): Promise<{
  extracted: BmfUstExtracted
  pdfPlainTextLength: number
}> {
  const buffer = await downloadBmfUstPdfBuffer(pdfUrl)
  const pdfPlainText = await pdfBufferToPlainText(buffer)
  const extracted = await extractBmfUstRatesWithOpenAI(pdfPlainText)
  return { extracted, pdfPlainTextLength: pdfPlainText.length }
}
