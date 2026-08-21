import { doc, getDoc } from 'firebase/firestore'
import { db, firebaseAuth } from '@/lib/firebase'

export interface ImapSyncStatus {
  connected: boolean
  email: string
}

const DEFAULT_STATUS: ImapSyncStatus = { connected: false, email: '' }

export async function fetchImapSyncStatus(uid: string): Promise<ImapSyncStatus> {
  if (!db) return DEFAULT_STATUS
  const snap = await getDoc(doc(db, 'users', uid))
  const stored = snap.data()?.imapSync as Partial<ImapSyncStatus> | undefined
  return { ...DEFAULT_STATUS, ...stored }
}

export interface ImapConnectParams {
  email: string
  host: string
  port: number
  password: string
}

/** Common provider presets — host/port only, the user still supplies their own address + app password. */
export const IMAP_PROVIDER_PRESETS = [
  { label: 'Gmail', host: 'imap.gmail.com', port: 993 },
  { label: 'Outlook / Hotmail', host: 'outlook.office365.com', port: 993 },
  { label: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993 },
  { label: 'iCloud', host: 'imap.mail.me.com', port: 993 },
] as const

export async function connectImap(params: ImapConnectParams): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')

  const response = await fetch('/api/imap/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, ...params }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo conectar.')
}

export async function disconnectImap(): Promise<void> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken()
  if (!idToken) throw new Error('No hay sesión activa.')

  const response = await fetch('/api/imap/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) throw new Error('No se pudo desconectar.')
}
