import { NextResponse } from "next/server"
import { persistBmfUstRatesFromPdfUrl } from "@/lib/bmf-ust-rates-persist"
import { getFirebaseAdminAuth, getFirebaseAdminNotReadyReason } from "@/lib/firebase-admin"

export const runtime = "nodejs"

function resolvePdfUrlFromRequest(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null && typeof (body as { pdfUrl?: unknown }).pdfUrl === "string") {
    const u = (body as { pdfUrl: string }).pdfUrl.trim()
    if (u.startsWith("https://")) return u
  }
  return undefined
}

/**
 * POST /api/bmf-ust-rates/sync
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body (JSON, optional): { "pdfUrl": "https://...pdf" } — or omit if `BMF_UST_DEFAULT_PDF_URL` is set
 *
 * Same ingest as the admin secret route, but gated on a signed-in user (verified server-side).
 */
export async function POST(req: Request) {
  const adminMissing = getFirebaseAdminNotReadyReason()
  if (adminMissing) {
    return NextResponse.json(
      {
        error:
          "Server is not configured for Firebase Admin. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS (same Firebase project as the web app).",
        details: adminMissing,
      },
      { status: 503 },
    )
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await getFirebaseAdminAuth().verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
  }

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  let pdfUrl = resolvePdfUrlFromRequest(body)
  pdfUrl = pdfUrl ?? process.env.BMF_UST_DEFAULT_PDF_URL?.trim()
  if (!pdfUrl) {
    return NextResponse.json(
      {
        error:
          "Set BMF_UST_DEFAULT_PDF_URL on the server or paste the PDF URL from the BMF page in the sync form.",
      },
      { status: 400 },
    )
  }

  try {
    const result = await persistBmfUstRatesFromPdfUrl(pdfUrl)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("bmf-ust-rates sync failed", e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
