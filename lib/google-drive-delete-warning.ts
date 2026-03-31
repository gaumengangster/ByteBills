import { getGoogleDriveAccessToken } from "@/lib/google-drive-upload-client"

/**
 * When deleting an app record that still has a linked Google Drive file id, we can only remove the
 * Drive file if the user has connected Drive in this browser session.
 */
export function driveDeleteOrphanWarning(hasLinkedDriveFiles: boolean): string | null {
  if (!hasLinkedDriveFiles) return null
  if (getGoogleDriveAccessToken()) return null
  return "Google Drive is not connected. This app will remove the record, but the linked file in Google Drive will not be deleted automatically. Connect Google Drive in the header first, or delete the file manually in Drive."
}
