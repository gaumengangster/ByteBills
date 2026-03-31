import type { NextRequest } from "next/server"
import { getGoogleDriveAccessTokenHeader } from "@/lib/env-public"

/**
 * OAuth access token from the request: FormData field (most reliable with multipart),
 * then Authorization: Bearer, then legacy custom header.
 */
export function resolveGoogleAccessTokenFromUploadRequest(
  request: NextRequest,
  form: FormData,
): string | null {
  const raw = form.get("accessToken")
  if (typeof raw === "string") {
    const t = raw.trim()
    if (t) return t
  }
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  const headerName = getGoogleDriveAccessTokenHeader()
  const h = request.headers.get(headerName)?.trim()
  return h || null
}

/** JSON delete route: body.accessToken, Authorization: Bearer, or custom header. */
export function resolveGoogleAccessTokenFromDeleteRequest(
  request: NextRequest,
  body: { accessToken?: unknown; fileId?: unknown },
): string | null {
  if (typeof body.accessToken === "string") {
    const t = body.accessToken.trim()
    if (t) return t
  }
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  const headerName = getGoogleDriveAccessTokenHeader()
  const h = request.headers.get(headerName)?.trim()
  return h || null
}
