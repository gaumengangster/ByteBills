/**
 * Server-only Firestore access (bypasses security rules). Used for admin ingestion jobs.
 *
 * This is separate from `NEXT_PUBLIC_FIREBASE_*` (web SDK). Invoices load in the browser with
 * your user token + Firestore rules; API routes need one of:
 * - `FIREBASE_SERVICE_ACCOUNT_JSON` — full service account JSON string
 * - `FIREBASE_SERVICE_ACCOUNT_PATH` — path to that JSON file (good for local dev)
 * - `GOOGLE_APPLICATION_CREDENTIALS` — path to JSON file (Firebase uses application default creds)
 */
import { applicationDefault, cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

let app: App | null = null

function resolveCredentialPath(p: string): string {
  const t = p.trim()
  if (t.startsWith("/") || /^[A-Za-z]:[\\/]/.test(t)) {
    return t
  }
  return resolve(process.cwd(), t)
}

/** When non-null, Admin SDK routes should return 503 with this message (do not treat as user auth failure). */
export function getFirebaseAdminNotReadyReason(): string | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    return null
  }

  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()
  if (pathEnv) {
    const abs = resolveCredentialPath(pathEnv)
    if (!existsSync(abs)) {
      return `FIREBASE_SERVICE_ACCOUNT_PATH file not found: ${abs}`
    }
    try {
      if (!readFileSync(abs, "utf8").trim()) {
        return `FIREBASE_SERVICE_ACCOUNT_PATH is empty: ${abs}`
      }
    } catch {
      return `FIREBASE_SERVICE_ACCOUNT_PATH not readable: ${abs}`
    }
    return null
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return null
  }

  return "No Admin credentials (set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS)"
}

function createFirebaseAdminApp(): App {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (rawJson?.trim()) {
    const parsed = JSON.parse(rawJson) as ServiceAccount
    return initializeApp({ credential: cert(parsed) })
  }

  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()
  if (pathEnv) {
    const abs = resolveCredentialPath(pathEnv)
    if (!existsSync(abs)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH file not found: ${abs}`)
    }
    const parsed = JSON.parse(readFileSync(abs, "utf8")) as ServiceAccount
    return initializeApp({ credential: cert(parsed) })
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return initializeApp({ credential: applicationDefault() })
  }

  throw new Error(
    "Firebase Admin not configured: set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS",
  )
}

export function getFirebaseAdminApp(): App {
  if (app) {
    return app
  }
  const existing = getApps()[0]
  if (existing) {
    app = existing
    return app
  }
  app = createFirebaseAdminApp()
  return app
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp())
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp())
}
