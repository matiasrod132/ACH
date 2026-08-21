import { NextResponse } from 'next/server'
import { verifyFirebaseIdToken } from '@/lib/server/verify-firebase-token'
import { signState } from '@/lib/server/oauth-state'
import { getAppOrigin } from '@/lib/server/app-url'

/**
 * Kicks off the "Conectar tu Gmail" flow: verifies the caller's Firebase ID
 * token (so we know their real uid, not a client-supplied one), then
 * redirects to Google's consent screen with a signed state param that the
 * callback route uses to recover that uid safely.
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_OAUTH_CLIENT_ID no configurado.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const idToken = searchParams.get('idToken')
  if (!idToken) {
    return NextResponse.json({ error: 'Falta idToken.' }, { status: 400 })
  }

  const verified = await verifyFirebaseIdToken(idToken)
  if (!verified) {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 })
  }
  const uid = verified.uid

  const redirectUri = `${getAppOrigin(request)}/api/gmail/oauth/callback`
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify')
  authUrl.searchParams.set('access_type', 'offline') // required to receive a refresh_token
  authUrl.searchParams.set('prompt', 'consent') // forces a fresh refresh_token even on repeat connects
  authUrl.searchParams.set('state', signState(uid))

  return NextResponse.redirect(authUrl.toString())
}
