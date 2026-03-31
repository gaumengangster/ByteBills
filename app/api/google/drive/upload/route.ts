import { NextRequest, NextResponse } from "next/server"
import { getGoogleDriveAccessTokenHeader } from "@/lib/env-public"
import { resolveGoogleAccessTokenFromUploadRequest } from "@/lib/google-drive-resolve-token"
import { isGoogleDriveUnauthorizedError, uploadBufferToGoogleDrive } from "@/lib/google-drive-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const accessToken = resolveGoogleAccessTokenFromUploadRequest(request, form)
    if (!accessToken) {
      const headerName = getGoogleDriveAccessTokenHeader()
      return NextResponse.json(
        { error: `Missing OAuth token (form field accessToken, Authorization: Bearer, or ${headerName})` },
        { status: 401 },
      )
    }

    const file = form.get("file")
    const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : ""

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || "application/octet-stream"

    const { id: fileId } = await uploadBufferToGoogleDrive({
      accessToken,
      name,
      mimeType,
      buffer,
    })

    return NextResponse.json({ ok: true, fileId })
  } catch (e) {
    console.error("google/drive/upload:", e)
    if (isGoogleDriveUnauthorizedError(e)) {
      return NextResponse.json(
        {
          error:
            "Google Drive session expired or invalid. Connect Google Drive again in the header, then retry.",
        },
        { status: 401 },
      )
    }
    const message = e instanceof Error ? e.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
