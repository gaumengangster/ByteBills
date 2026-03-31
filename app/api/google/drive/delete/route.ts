import { NextRequest, NextResponse } from "next/server"
import { getGoogleDriveAccessTokenHeader } from "@/lib/env-public"
import { resolveGoogleAccessTokenFromDeleteRequest } from "@/lib/google-drive-resolve-token"
import { deleteFileFromGoogleDrive, isGoogleDriveUnauthorizedError } from "@/lib/google-drive-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { fileId?: string; accessToken?: string }
    const accessToken = resolveGoogleAccessTokenFromDeleteRequest(request, body)
    if (!accessToken) {
      const headerName = getGoogleDriveAccessTokenHeader()
      return NextResponse.json(
        { error: `Missing OAuth token (body.accessToken, Authorization: Bearer, or ${headerName})` },
        { status: 401 },
      )
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : ""
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 })
    }

    await deleteFileFromGoogleDrive({ accessToken, fileId })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("google/drive/delete:", e)
    if (isGoogleDriveUnauthorizedError(e)) {
      return NextResponse.json(
        {
          error:
            "Google Drive session expired or invalid. Connect Google Drive again in the header, then retry.",
        },
        { status: 401 },
      )
    }
    const message = e instanceof Error ? e.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
