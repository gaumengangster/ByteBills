import { NextResponse } from "next/server"
import { persistBmfUstRatesFromPdfUrl } from "@/lib/bmf-ust-rates-persist"
import { getFirebaseAdminNotReadyReason } from "@/lib/firebase-admin"

export const runtime = "nodejs"

/**
 * POST /api/admin/bmf-ust-rates/ingest
 * Headers: Authorization: Bearer <BMF_UST_INGEST_SECRET>
 * Body (JSON): { "pdfUrl": "https://...pdf" } — or omit `pdfUrl` if `BMF_UST_DEFAULT_PDF_URL` is set
 *
 * Downloads the BMF PDF, extracts text, calls OpenAI for structured rates, merges into Firestore
 * `bmfUstRates/{year}` (server account; clients cannot write this collection).
 */
export async function POST(req: Request) {
  const adminMissing = getFirebaseAdminNotReadyReason()
  if (adminMissing) {
    return NextResponse.json(
      { error: "FIREBASE_SERVICE_ACCOUNT_JSON is not set", details: adminMissing },
      { status: 503 },
    )
  }

  const secret = process.env.BMF_UST_INGEST_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let pdfUrl: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.pdfUrl === "string" && body.pdfUrl.startsWith("https://")) {
      pdfUrl = body.pdfUrl
    }
  } catch {
    /* empty body */
  }
  pdfUrl = pdfUrl ?? process.env.BMF_UST_DEFAULT_PDF_URL
  if (!pdfUrl?.trim()) {
    return NextResponse.json(
      {
        error:
          "Missing pdfUrl in JSON body and BMF_UST_DEFAULT_PDF_URL is unset. Pass { \"pdfUrl\": \"https://...pdf\" } from the BMF publication page.",
      },
      { status: 400 },
    )
  }

  try {
    const result = await persistBmfUstRatesFromPdfUrl(pdfUrl)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("bmf-ust-rates ingest failed", e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
