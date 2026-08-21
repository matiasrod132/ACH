import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyFirebaseIdToken } from '@/lib/server/verify-firebase-token'

export async function POST(request: Request) {
  const { idToken } = (await request.json().catch(() => ({}))) as { idToken?: string }
  if (!idToken) return NextResponse.json({ error: 'Falta idToken.' }, { status: 400 })

  const verified = await verifyFirebaseIdToken(idToken)
  if (!verified) {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 })
  }
  const uid = verified.uid

  const db = adminDb()
  await db.collection('imapCredentials').doc(uid).delete()
  await db.collection('users').doc(uid).set({ imapSync: { connected: false, email: '' } }, { merge: true })

  return NextResponse.json({ success: true })
}
