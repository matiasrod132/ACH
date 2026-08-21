import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { sendPushToUser } from '@/lib/server/push'
import {
  buildGmailQuery,
  categorizeWithGroq,
  extraerDatosBancoNativo,
  gmailGetMessage,
  gmailListMessageIds,
  gmailMarkRead,
  movementDocId,
  refreshGoogleAccessToken,
  shouldSkipEmail,
} from '@/lib/server/bank-sync'

/**
 * Multi-user replacement for apps-script/Code.gs's procesarMailsBancoGuayaquil —
 * meant to be hit by a free external cron (cron-job.org, a GitHub Actions
 * schedule, etc.) every 5 minutes. Loops over every user who connected their
 * Gmail (see app/api/gmail/oauth/*), and for each one: lists unread
 * transactional emails, categorizes them, saves movements, marks them read,
 * and sends a push notification — same rules and same Firestore shape as the
 * single-user Apps Script path, so both can coexist without creating
 * duplicates (movement doc ids are deterministic from the Gmail message id).
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
  created: number
  duplicates: number
  skipped: number
  errors: number
}

async function syncUser(uid: string, email: string): Promise<UserSyncResult> {
  const result: UserSyncResult = { uid, email, created: 0, duplicates: 0, skipped: 0, errors: 0 }
  const db = adminDb()

  const tokenDoc = await db.collection('gmailSyncTokens').doc(uid).get()
  const refreshToken = tokenDoc.data()?.refreshToken as string | undefined
  if (!refreshToken) return result

  const accessToken = await refreshGoogleAccessToken(refreshToken)
  if (!accessToken) {
    result.errors++
    return result
  }

  const groqApiKey = process.env.GROQ_API_KEY
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

  const messageIds = await gmailListMessageIds(accessToken, buildGmailQuery('is:unread newer_than:30d'))

  for (const messageId of messageIds) {
    try {
      const message = await gmailGetMessage(accessToken, messageId)
      if (!message) {
        result.errors++
        continue
      }

      const fullText = `${message.subject}\n${message.bodyText}`
      const skip = shouldSkipEmail(message.subject, fullText)
      if (skip.skip) {
        result.skipped++
        await gmailMarkRead(accessToken, messageId)
        continue
      }

      const datosBase = extraerDatosBancoNativo(fullText)
      if (!datosBase) {
        result.skipped++
        await gmailMarkRead(accessToken, messageId)
        continue
      }

      const docId = movementDocId(messageId)
      const movementRef = db.collection('users').doc(uid).collection('financeMovements').doc(docId)
      const existing = await movementRef.get()
      if (existing.exists) {
        result.duplicates++
        await gmailMarkRead(accessToken, messageId)
        continue
      }

      let category = datosBase.category
      let description = datosBase.description
      if (groqApiKey) {
        const refined = await categorizeWithGroq(fullText, datosBase, groqApiKey, groqModel)
        if (refined) {
          category = refined.category
          description = refined.description
        }
      }

      const date = new Date(message.internalDate).toISOString().slice(0, 10)

      await movementRef.set({
        type: datosBase.type,
        amount: datosBase.amount,
        category,
        description,
        date,
        createdAt: FieldValue.serverTimestamp(),
        source: 'gmail_oauth_sync',
        automatic: true,
      })
      result.created++

      const sign = datosBase.type === 'income' ? '+' : '-'
      await sendPushToUser(
        uid,
        datosBase.type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto',
        `${sign}$${datosBase.amount} · ${description}`,
      )

      await gmailMarkRead(accessToken, messageId)
    } catch (err) {
      console.error(`[sync-gmail] Error procesando mensaje ${messageId} para ${uid}:`, err)
      result.errors++
    }
  }

  return result
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = adminDb()
  const connectedUsers = await db.collection('users').where('gmailSync.connected', '==', true).get()

  const results: UserSyncResult[] = []
  for (const userDoc of connectedUsers.docs) {
    const email = (userDoc.data().gmailSync?.email as string) ?? ''
    try {
      results.push(await syncUser(userDoc.id, email))
    } catch (err) {
      console.error(`[sync-gmail] Error con el usuario ${userDoc.id}:`, err)
      results.push({ uid: userDoc.id, email, created: 0, duplicates: 0, skipped: 0, errors: 1 })
    }
  }

  return NextResponse.json({ usersProcessed: results.length, results })
}
