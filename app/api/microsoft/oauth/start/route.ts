import { NextResponse } from 'next/server'
import { verifyFirebaseIdToken } from '@/lib/server/verify-firebase-token'
import { signState } from '@/lib/server/oauth-state'
import { getAppOrigin } from '@/lib/server/app-url'
import { MICROSOFT_OAUTH_SCOPE } from '@/lib/server/microsoft-sync'

/** Mirrors app/api/gmail/oauth/start — same idToken verification + signed-state pattern, different provider. */
export async function GET(request: Request) {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'MICROSOFT_OAUTH_CLIENT_ID no configurado.' }, { status: 500 })
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

  const redirectUri = `${getAppOrigin(request)}/api/microsoft/oauth/callback`
  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('response_mode', 'query')
  authUrl.searchParams.set('scope', MICROSOFT_OAUTH_SCOPE)
  authUrl.searchParams.set('state', signState(verified.uid))
  authUrl.searchParams.set('prompt', 'consent') // ensures a refresh_token is issued even on repeat connects

  return NextResponse.redirect(authUrl.toString())
}
