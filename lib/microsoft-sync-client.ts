import { doc, getDoc } from 'firebase/firestore'
import { db, firebaseAuth } from '@/lib/firebase'

export interface MicrosoftSyncStatus {
  connected: boolean
  email: string
}

const DEFAULT_STATUS: MicrosoftSyncStatus = { connected: false, email: '' }

export async function fetchMicrosoftSyncStatus(uid: string): Promise<MicrosoftSyncStatus> {
  if (!db) return DEFAULT_STATUS
  const snap = await getDoc(doc(db, 'users', uid))
  const stored = snap.data()?.microsoftSync as Partial<MicrosoftSyncStatus> | undefined
  return { ...DEFAULT_STATUS, ...stored }
}

export async function connectMicrosoft(): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')
  window.location.href = `/api/microsoft/oauth/start?idToken=${encodeURIComponent(idToken)}`
}

export async function disconnectMicrosoft(): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')

  const response = await fetch('/api/microsoft/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) throw new Error('No se pudo desconectar Microsoft.')
}
