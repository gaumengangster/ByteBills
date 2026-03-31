import {
  getGoogleDriveAccessTokenHeader,
  getGoogleDriveAccessTokenKey,
  GOOGLE_DRIVE_TOKEN_INVALID_EVENT,
} from "@/lib/env-public"

export function getGoogleDriveAccessToken(): string | null {
  if (typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(getGoogleDriveAccessTokenKey())
}

export async function uploadFileToGoogleDrive(file: File, displayName: string): Promise<{ fileId: string }> {
  const token = getGoogleDriveAccessToken()
  if (!token) {
    throw new Error("Google Drive is not connected. Connect Drive and try again.")
  }

  const fd = new FormData()
  fd.append("file", file)
  fd.append("name", displayName)
  /** Redundant paths: multipart can strip custom headers; server reads this first. */
  fd.append("accessToken", token)

  const headerName = getGoogleDriveAccessTokenHeader()
  const res = await fetch("/api/google/drive/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      [headerName]: token,
    },
    body: fd,
  })

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.status === 401 && typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(getGoogleDriveAccessTokenKey())
      window.dispatchEvent(new CustomEvent(GOOGLE_DRIVE_TOKEN_INVALID_EVENT))
    }
    throw new Error(j.error || `Drive upload failed (${res.status})`)
  }

  const j = (await res.json()) as { fileId?: string }
  if (!j.fileId) {
    throw new Error("Drive upload returned no file id")
  }
  return { fileId: j.fileId }
}

/** Deletes a file created by this app (Drive API). No-op if no token (caller may skip). */
export async function deleteGoogleDriveFile(fileId: string): Promise<void> {
  const token = getGoogleDriveAccessToken()
  if (!token) {
    throw new Error("Google Drive is not connected.")
  }

  const headerName = getGoogleDriveAccessTokenHeader()
  const res = await fetch("/api/google/drive/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      [headerName]: token,
    },
    body: JSON.stringify({ fileId, accessToken: token }),
  })

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.status === 401 && typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(getGoogleDriveAccessTokenKey())
      window.dispatchEvent(new CustomEvent(GOOGLE_DRIVE_TOKEN_INVALID_EVENT))
    }
    throw new Error(j.error || `Drive delete failed (${res.status})`)
  }
}
