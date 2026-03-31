import { NextRequest, NextResponse } from "next/server"
import { extractBillFromImageBase64, extractBillFromText } from "@/lib/extract-bill-openai"
import { extractPdfText } from "@/lib/pdf-text-extract"

export const runtime = "nodejs"
export const maxDuration = 120

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf"
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let mimeType = file.type || "application/octet-stream"
    if (!file.type || file.type === "application/octet-stream") {
      const sniffed = sniffMime(buffer)
      if (sniffed) mimeType = sniffed
    }

    if (mimeType === "application/pdf") {
      const text = await extractPdfText(buffer)
      if (!text || text.length < 20) {
        return NextResponse.json(
          {
            error:
              "Could not extract enough text from this PDF. Try a photo or a text-based PDF.",
          },
          { status: 422 }
        )
      }
      const extracted = await extractBillFromText(text)
      return NextResponse.json({ extracted })
    }

    if (ALLOWED_IMAGE.has(mimeType)) {
      const base64 = buffer.toString("base64")
      const extracted = await extractBillFromImageBase64(base64, mimeType)
      return NextResponse.json({ extracted })
    }

    return NextResponse.json(
      { error: "Unsupported file type. Use PDF or an image (JPEG, PNG, WebP)." },
      { status: 400 }
    )
  } catch (e) {
    console.error("costs/extract:", e)
    const message = e instanceof Error ? e.message : "Extraction failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
