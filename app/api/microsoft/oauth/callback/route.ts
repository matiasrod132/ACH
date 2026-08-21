import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyState } from '@/lib/server/oauth-state'
import { getAppOrigin } from '@/lib/server/app-url'
import { exchangeMicrosoftCode, fetchMicrosoftProfile } from '@/lib/server/microsoft-sync'

export async function GET(request: Request) {
  const appOrigin = getAppOrigin(request)
  const settingsUrl = new URL('/ajustes', appOrigin)
  const { searchParams } = new URL(request.url)

  const error = searchParams.get('error')
  if (error) {
    settingsUrl.searchParams.set('microsoft', 'denied')
    return NextResponse.redirect(settingsUrl)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) {
    settingsUrl.searchParams.set('microsoft', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  const uid = verifyState(state)
  if (!uid) {
    settingsUrl.searchParams.set('microsoft', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const redirectUri = `${appOrigin}/api/microsoft/oauth/callback`
    const tokens = await exchangeMicrosoftCode(code, redirectUri)
    if (!tokens) {
      settingsUrl.searchParams.set('microsoft', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const email = await fetchMicrosoftProfile(tokens.accessToken)

    const db = adminDb()
    // Refresh token: locked-down collection, no client access at all (see firestore.rules).
    await db.collection('microsoftSyncTokens').doc(uid).set({
      refreshToken: tokens.refreshToken,
      email,
      connectedAt: new Date().toISOString(),
    })
    await db.collection('users').doc(uid).set({ microsoftSync: { connected: true, email } }, { merge: true })

    settingsUrl.searchParams.set('microsoft', 'connected')
    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error('Microsoft OAuth callback error:', err)
    settingsUrl.searchParams.set('microsoft', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
