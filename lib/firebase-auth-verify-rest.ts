import { createRemoteJWKSet, jwtVerify } from "jose"

const secureTokenJwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
)

/**
 * Verify a Firebase Auth ID token (signature + iss/aud/exp) using Google's JWKS.
 *
 * Unlike Identity Toolkit `accounts:lookup`, this does **not** use `NEXT_PUBLIC_FIREBASE_API_KEY`.
 * Browser-restricted API keys often break server-side `accounts:lookup` (no referrer) and return 401/403.
 */
export async function verifyFirebaseWebIdToken(idToken: string): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set")
  }
  try {
    await jwtVerify(idToken, secureTokenJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
  } catch {
    throw new Error("Invalid or expired session")
  }
}
