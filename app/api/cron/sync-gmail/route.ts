import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  buildGmailQuery,
  gmailGetMessage,
  gmailListMessageIds,
  gmailMarkRead,
  processEmailCandidate,
  refreshGoogleAccessToken,
  type ProcessOutcome,
} from '@/lib/server/bank-sync'
import { syncImapUser, type ImapCredentials } from '@/lib/server/imap-sync'
import { decryptSecret } from '@/lib/server/crypto-secret'

/**
 * Multi-user replacement for apps-script/Code.gs's procesarMailsBancoGuayaquil —
 * meant to be hit by a free external cron (cron-job.org, a GitHub Actions
 * schedule, etc.) every 5 minutes. Two independent connection paths feed the
 * same shared pipeline (lib/server/bank-sync.ts's processEmailCandidate):
 *
 *   - Gmail OAuth (app/api/gmail/oauth/*) — for Gmail users specifically.
 *   - IMAP + app password (app/api/imap/*) — provider-agnostic (Outlook,
 *     Yahoo, iCloud, Gmail via app password too), no OAuth consent screen
 *     or Google brand verification needed.
 *
 * Both write movements with the same deterministic doc-id scheme, so they
 * (and the original single-user Apps Script) never create duplicates even
 * if more than one path ever saw the same email.
 *
 * No Cloud Functions involved — this is a plain Next.js route, so it costs
 * nothing beyond whatever your hosting's normal request pricing is (free on
 * typical hobby-tier hosting for a request every 5 minutes).
 */

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const header = request.headers.get('authorization')
  if (header === `Bearer ${expected}`) return true

  const url = new URL(request.url)
  return url.searchParams.get('secret') === expected
}

interface UserSyncResult {
  uid: string
  email: string
  source: 'gmail' | 'imap'
  created: number
  duplicates: number
  skipped: number
  errors: number
}

async function syncGmailUser(uid: string, email: string, groqApiKey: string | undefined, groqModel: string): Promise<UserSyncResult> {
  const result: UserSyncResult = { uid, email, source: 'gmail', created: 0, duplicates: 0, skipped: 0, errors: 0 }
  const db = adminDb()

  const tokenDoc = await db.collection('gmailSyncTokens').doc(uid).get()
  const refreshToken = tokenDoc.data()?.refreshToken as string | undefined
  if (!refreshToken) return result

  const accessToken = await refreshGoogleAccessToken(refreshToken)
  if (!accessToken) {
    result.errors++
    return result
  }

  const messageIds = await gmailListMessageIds(accessToken, buildGmailQuery('is:unread newer_than:30d'))

  for (const messageId of messageIds) {
    try {
      const message = await gmailGetMessage(accessToken, messageId)
      if (!message) {
        result.errors++
        continue
      }

      const date = new Date(message.internalDate).toISOString().slice(0, 10)
      const outcome: ProcessOutcome = await processEmailCandidate(
        uid,
        { id: messageId, subject: message.subject, bodyText: message.bodyText, date },
        'gmail_oauth_sync',
        groqApiKey,
        groqModel,
      )

      if (outcome === 'created') result.created++
      else if (outcome === 'duplicate') result.duplicates++
      else result.skipped++

      await gmailMarkRead(accessToken, messageId)
    } catch (err) {
      console.error(`[sync-gmail] Error procesando mensaje ${messageId} para ${uid}:`, err)
      result.errors++
    }
  }

  return result
}

async function syncImapConnectedUser(
  uid: string,
  email: string,
  groqApiKey: string | undefined,
  groqModel: string,
): Promise<UserSyncResult> {
  const result: UserSyncResult = { uid, email, source: 'imap', created: 0, duplicates: 0, skipped: 0, errors: 0 }
  const db = adminDb()

  const credDoc = await db.collection('imapCredentials').doc(uid).get()
  const data = credDoc.data()
  if (!data) return result

  try {
    const creds: ImapCredentials = {
      host: data.host,
      port: data.port,
      email: data.email,
      password: decryptSecret({ encrypted: data.encrypted, iv: data.iv, authTag: data.authTag }),
    }
    const imapResult = await syncImapUser(uid, creds, groqApiKey, groqModel)
    result.created = imapResult.created
    result.duplicates = imapResult.duplicates
    result.skipped = imapResult.skipped
    result.errors = imapResult.errors
  } catch (err) {
    console.error(`[sync-gmail] Error IMAP para ${uid}:`, err)
    result.errors++
  }

  return result
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const db = adminDb()

  const results: UserSyncResult[] = []

  const gmailUsers = await db.collection('users').where('gmailSync.connected', '==', true).get()
  for (const userDoc of gmailUsers.docs) {
    const email = (userDoc.data().gmailSync?.email as string) ?? ''
    try {
      results.push(await syncGmailUser(userDoc.id, email, groqApiKey, groqModel))
    } catch (err) {
      console.error(`[sync-gmail] Error con el usuario ${userDoc.id}:`, err)
      results.push({ uid: userDoc.id, email, source: 'gmail', created: 0, duplicates: 0, skipped: 0, errors: 1 })
    }
  }

  const imapUsers = await db.collection('users').where('imapSync.connected', '==', true).get()
  for (const userDoc of imapUsers.docs) {
    const email = (userDoc.data().imapSync?.email as string) ?? ''
    try {
      results.push(await syncImapConnectedUser(userDoc.id, email, groqApiKey, groqModel))
    } catch (err) {
      console.error(`[sync-gmail] Error IMAP con el usuario ${userDoc.id}:`, err)
      results.push({ uid: userDoc.id, email, source: 'imap', created: 0, duplicates: 0, skipped: 0, errors: 1 })
    }
  }

  return NextResponse.json({ usersProcessed: results.length, results })
}
