import path from "node:path"
import { pathToFileURL } from "node:url"

type PdfParseModule = typeof import("pdf-parse")

let pdfParseModule: PdfParseModule | null = null

async function loadPdfParse(): Promise<PdfParseModule> {
  if (pdfParseModule) return pdfParseModule
  const mod = await import("pdf-parse")
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  )
  mod.PDFParse.setWorker(pathToFileURL(workerPath).href)
  pdfParseModule = mod
  return mod
}

/**
 * Extract plain text from a PDF buffer. Configures pdf.js worker path so
 * Next.js does not resolve `pdf.worker.mjs` inside `.next/chunks/`.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await loadPdfParse()
  const parser = new PDFParse({ data: buffer })
  try {
    const textResult = await parser.getText()
    return (textResult.text || "").trim()
  } finally {
    await parser.destroy()
  }
}
