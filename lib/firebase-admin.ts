import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// Server-only. Never import this from a 'use client' component — it needs a
// service account private key that must never reach the browser bundle.
//
// Get the three env vars below from Firebase Console > Project settings >
// Service accounts > Generate new private key (downloads a JSON file):
//   FIREBASE_ADMIN_PROJECT_ID    -> "project_id" in the JSON
//   FIREBASE_ADMIN_CLIENT_EMAIL  -> "client_email" in the JSON
//   FIREBASE_ADMIN_PRIVATE_KEY   -> "private_key" in the JSON (keep the
//                                   \n escapes as literal two-character
//                                   sequences when pasting into .env.local —
//                                   this file unescapes them below)

function adminApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan credenciales del Admin SDK (FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY).',
    )
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export function adminDb() {
  return getFirestore(adminApp())
}

export function adminAuth() {
  return getAuth(adminApp())
}

export function adminMessaging() {
  return getMessaging(adminApp())
}
