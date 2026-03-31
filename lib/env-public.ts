/**
 * Non-secret defaults configurable via `.env.local` (`NEXT_PUBLIC_*` is available in the browser).
 * See `.env.local` for variable names; fallbacks match previous hardcoded values.
 */

export function getGoogleDriveAccessTokenKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN_KEY ?? "bytebills_google_drive_access_token"
}

/** Request header carrying the Google OAuth access token (client + API route must match). */
export function getGoogleDriveAccessTokenHeader(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN_HEADER ?? "X-Google-Access-Token"
}

/** Fired when the server rejects the stored Drive token so UI can clear “connected” state. */
export const GOOGLE_DRIVE_TOKEN_INVALID_EVENT = "bytebills-google-drive-token-invalid"

/** Charts / UI default display currency (ISO code). */
export function getDisplayCurrency(): string {
  return process.env.NEXT_PUBLIC_DISPLAY_CURRENCY ?? "EUR"
}
