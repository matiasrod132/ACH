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
  const tokenDoc = await db.collection('gmailSyncTokens').doc(uid).get()
  const refreshToken = tokenDoc.data()?.refreshToken as string | undefined

  // Best-effort: revoke at Google too, not just locally. A failure here
  // isn't fatal — deleting our stored token already stops the sync.
  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
      })
    } catch {
      // Ignore — Google's revoke endpoint being briefly unavailable shouldn't block disconnecting locally.
    }
  }

  await db.collection('gmailSyncTokens').doc(uid).delete()
  await db.collection('users').doc(uid).set({ gmailSync: { connected: false, email: '' } }, { merge: true })

  return NextResponse.json({ success: true })
}
