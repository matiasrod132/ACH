import { matchesTransactionalPattern, stripHtml, type EmailCandidate } from '@/lib/server/bank-sync'
import type { BankProfile } from '@/lib/bank-profiles'

// Microsoft Graph API — the OAuth alternative to IMAP+app-password for
// Outlook/Hotmail/personal Microsoft accounts. Mirrors the Gmail OAuth path
// in shape (see app/api/gmail/oauth/*, lib/server/bank-sync.ts's Gmail REST
// helpers) but talks to Microsoft's endpoints instead.
//
// Important difference from Google: Microsoft ROTATES refresh tokens — every
// token refresh returns a new refresh_token that must be saved, replacing
// the old one, or the next refresh will fail. refreshMicrosoftAccessToken
// returns the new refresh_token for the caller to persist.

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
export const MICROSOFT_OAUTH_SCOPE = 'openid email profile offline_access Mail.Read'

export interface MicrosoftTokenResult {
  accessToken: string
  refreshToken: string
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
): Promise<MicrosoftTokenResult | null> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_OAUTH_SCOPE,
    }),
  })
  if (!response.ok) return null

  const data = await response.json()
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') return null
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<MicrosoftTokenResult | null> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_OAUTH_SCOPE,
    }),
  })
  if (!response.ok) return null

  const data = await response.json()
  if (typeof data.access_token !== 'string') return null
  // Microsoft may or may not rotate the refresh token on a given call — fall back to the old one if absent.
  const newRefreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : refreshToken
  return { accessToken: data.access_token, refreshToken: newRefreshToken }
}

export async function fetchMicrosoftProfile(accessToken: string): Promise<string> {
  const response = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return ''
  const data = await response.json()
  return data.mail || data.userPrincipalName || ''
}

interface GraphMessage {
  id: string
  subject?: string
  from?: { emailAddress?: { address?: string } }
  receivedDateTime?: string
  body?: { contentType?: string; content?: string }
  bodyPreview?: string
}

/** Fetches unread inbox messages and filters them client-side against the user's bank profile — Graph's $filter OData syntax doesn't cleanly express "any of these senders AND subject starts with any of these", so this mirrors the IMAP path's approach instead of Gmail's server-side query. */
export async function microsoftListCandidates(
  accessToken: string,
  bankProfile: BankProfile,
): Promise<EmailCandidate[]> {
  const url =
    `${GRAPH_BASE}/me/mailFolders/inbox/messages` +
    `?$filter=isRead eq false&$top=50&$select=subject,from,receivedDateTime,body`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) return []

  const data = await response.json()
  const messages: GraphMessage[] = Array.isArray(data.value) ? data.value : []

  const candidates: EmailCandidate[] = []
  for (const msg of messages) {
    const from = msg.from?.emailAddress?.address ?? ''
    const subject = msg.subject ?? ''
    if (!matchesTransactionalPattern(bankProfile, from, subject)) continue

    const rawBody = msg.body?.content ?? msg.bodyPreview ?? ''
    const bodyText = msg.body?.contentType === 'html' ? stripHtml(rawBody) : rawBody
    const date = (msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date()).toISOString().slice(0, 10)

    candidates.push({ id: msg.id, subject, bodyText, date })
  }

  return candidates
}

export async function microsoftMarkRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead: true }),
  })
}
