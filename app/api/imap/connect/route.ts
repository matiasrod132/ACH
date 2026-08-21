import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyFirebaseIdToken } from '@/lib/server/verify-firebase-token'
import { testImapLogin } from '@/lib/server/imap-sync'
import { encryptSecret } from '@/lib/server/crypto-secret'

interface ConnectBody {
  idToken?: string
  email?: string
  host?: string
  port?: number
  password?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ConnectBody
  const { idToken, email, host, password } = body
  const port = Number(body.port)

  if (!idToken) return NextResponse.json({ error: 'Falta idToken.' }, { status: 400 })
  if (!email || !host || !password || !Number.isFinite(port) || port <= 0) {
    return NextResponse.json({ error: 'Faltan datos: correo, host, puerto y contraseña.' }, { status: 400 })
  }

  const verified = await verifyFirebaseIdToken(idToken)
  if (!verified) {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 })
  }
  const uid = verified.uid

  const loginResult = await testImapLogin({ host, port, email, password })
  if (!loginResult.ok) {
    return NextResponse.json(
      { error: `No se pudo conectar: ${loginResult.error}` },
      { status: 400 },
    )
  }

  const db = adminDb()
  // App password: locked-down collection, encrypted at rest — see firestore.rules and lib/server/crypto-secret.ts.
  await db.collection('imapCredentials').doc(uid).set({
    email,
    host,
    port,
    ...encryptSecret(password),
    connectedAt: new Date().toISOString(),
  })
  await db.collection('users').doc(uid).set({ imapSync: { connected: true, email } }, { merge: true })

  return NextResponse.json({ success: true })
}
