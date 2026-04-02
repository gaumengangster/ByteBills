import { NextResponse } from "next/server"
import { resolveAllowedBmfCsvUrl } from "@/lib/bmf-ust-rates-csv"
import { verifyFirebaseWebIdToken } from "@/lib/firebase-auth-verify-rest"

export const runtime = "nodejs"

function parseYear(body: unknown): number | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const y = (body as { year?: unknown }).year
  if (typeof y === "number" && Number.isInteger(y)) return y
  if (typeof y === "string" && /^\d{4}$/.test(y.trim())) return parseInt(y.trim(), 10)
  return undefined
}

function parseCsvUrl(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const u = (body as { csvUrl?: unknown }).csvUrl
  if (typeof u !== "string") return undefined
  const t = u.trim()
  return t.startsWith("https://") ? t : undefined
}

/**
 * POST /api/bmf-ust-rates/fetch-csv
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body (JSON, optional): { "year": 2026, "csvUrl": "https://www.bundesfinanzministerium.de/..." }
 *
 * Verifies the ID token with Google JWKS (uses NEXT_PUBLIC_FIREBASE_PROJECT_ID; no API key), downloads the CSV
 * server-side (avoids browser CORS), returns JSON { csvText, sourceCsvUrl, csvBytes } for the
 * client to write with the Firestore web SDK.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await verifyFirebaseWebIdToken(token)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid or expired session"
    return NextResponse.json({ error: message }, { status: 401 })
  }

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const now = new Date()
  const year = parseYear(body) ?? now.getUTCFullYear()
  let sourceCsvUrl: string
  try {
    sourceCsvUrl = resolveAllowedBmfCsvUrl(year, parseCsvUrl(body))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid CSV URL"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const res = await fetch(sourceCsvUrl, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: `CSV fetch failed: ${res.status}` }, { status: 502 })
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 80) {
      return NextResponse.json({ error: "CSV response too small" }, { status: 502 })
    }
    const csvText = buf.toString("latin1")
    return NextResponse.json({
      csvText,
      sourceCsvUrl,
      csvBytes: buf.length,
    })
  } catch (e) {
    console.error("bmf-ust-rates/fetch-csv:", e)
    const message = e instanceof Error ? e.message : "CSV fetch failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
