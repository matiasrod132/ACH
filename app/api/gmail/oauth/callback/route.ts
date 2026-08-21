import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyState } from '@/lib/server/oauth-state'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const settingsUrl = new URL('/ajustes', origin)

  const error = searchParams.get('error')
  if (error) {
    settingsUrl.searchParams.set('gmail', 'denied')
    return NextResponse.redirect(settingsUrl)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) {
    settingsUrl.searchParams.set('gmail', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  const uid = verifyState(state)
  if (!uid) {
    settingsUrl.searchParams.set('gmail', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    settingsUrl.searchParams.set('gmail', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const redirectUri = `${origin}/api/gmail/oauth/callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Gmail OAuth token exchange failed:', await tokenResponse.text())
      settingsUrl.searchParams.set('gmail', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const tokens = await tokenResponse.json()
    const refreshToken: string | undefined = tokens.refresh_token
    const accessToken: string | undefined = tokens.access_token

    if (!refreshToken || !accessToken) {
      // No refresh_token usually means the user had already granted consent
      // before and Google didn't reissue one — access_type=offline +
      // prompt=consent on /start should prevent this, but guard anyway.
      settingsUrl.searchParams.set('gmail', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const profile = profileResponse.ok ? await profileResponse.json() : null
    const email: string = profile?.emailAddress ?? ''

    const db = adminDb()
    // Refresh token: locked-down collection, no client access at all (see firestore.rules).
    await db.collection('gmailSyncTokens').doc(uid).set({
      refreshToken,
      email,
      connectedAt: new Date().toISOString(),
    })
    // Non-secret status flag on the regular user doc, so the client UI can
    // show connection status without ever reading the token itself.
    await db.collection('users').doc(uid).set(
      { gmailSync: { connected: true, email } },
      { merge: true },
    )

    settingsUrl.searchParams.set('gmail', 'connected')
    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    settingsUrl.searchParams.set('gmail', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
