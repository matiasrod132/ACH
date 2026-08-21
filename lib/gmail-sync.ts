import { doc, getDoc } from 'firebase/firestore'
import { db, firebaseAuth } from '@/lib/firebase'

export interface GmailSyncStatus {
  connected: boolean
  email: string
}

const DEFAULT_STATUS: GmailSyncStatus = { connected: false, email: '' }

export async function fetchGmailSyncStatus(uid: string): Promise<GmailSyncStatus> {
  if (!db) return DEFAULT_STATUS
  const snap = await getDoc(doc(db, 'users', uid))
  const stored = snap.data()?.gmailSync as Partial<GmailSyncStatus> | undefined
  return { ...DEFAULT_STATUS, ...stored }
}

/** Redirects the browser to Google's consent screen — there's no JSON response, this navigates away. */
export async function connectGmail(): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')
  window.location.href = `/api/gmail/oauth/start?idToken=${encodeURIComponent(idToken)}`
}

export async function disconnectGmail(): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')

  const response = await fetch('/api/gmail/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) throw new Error('No se pudo desconectar Gmail.')
}
