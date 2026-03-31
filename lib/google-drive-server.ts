import { Readable } from "stream"
import { GaxiosError } from "gaxios"
import { google } from "googleapis"

/** Expired / revoked token or wrong OAuth client (Drive uses 401 for bad bearer tokens). */
export function isGoogleDriveUnauthorizedError(e: unknown): boolean {
  return e instanceof GaxiosError && e.response?.status === 401
}

/** GSI access tokens work reliably when OAuth2 client is created with the same Web client ID. */
function driveClientForAccessToken(accessToken: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  const oauth2Client = clientId
    ? new google.auth.OAuth2(clientId)
    : new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.drive({ version: "v3", auth: oauth2Client })
}

export async function uploadBufferToGoogleDrive(params: {
  accessToken: string
  name: string
  mimeType: string
  buffer: Buffer
}): Promise<{ id: string }> {
  const drive = driveClientForAccessToken(params.accessToken)
  const parent = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || undefined
  const body = Readable.from(params.buffer)
  const res = await drive.files.create({
    requestBody: {
      name: params.name,
      ...(parent ? { parents: [parent] } : {}),
    },
    media: {
      mimeType: params.mimeType || "application/octet-stream",
      body,
    },
    fields: "id",
  })
  const id = res.data.id
  if (!id) throw new Error("Google Drive did not return a file id")
  return { id }
}

export async function deleteFileFromGoogleDrive(params: {
  accessToken: string
  fileId: string
}): Promise<void> {
  const drive = driveClientForAccessToken(params.accessToken)
  try {
    await drive.files.delete({ fileId: params.fileId })
  } catch (e: unknown) {
    const err = e as { code?: number; response?: { status?: number } }
    if (err.code === 404 || err.response?.status === 404) return
    throw e
  }
}
