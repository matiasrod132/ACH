import { adminDb, adminMessaging } from '@/lib/firebase-admin'

/**
 * Sends a push notification to every FCM token a user has registered
 * (users/{uid}/pushTokens, written by lib/push-notifications.ts on the
 * client). Best-effort: a missing/invalid token is skipped, never thrown —
 * this must never interrupt whatever server-side flow called it (e.g. the
 * Gmail sync cron).
 */
export async function sendPushToUser(uid: string, title: string, body: string): Promise<void> {
  try {
    const db = adminDb()
    const tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get()
    if (tokensSnap.empty) return

    const tokens = tokensSnap.docs.map((d) => d.id)
    const messaging = adminMessaging()

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
    })

    // Clean up tokens FCM reports as dead (uninstalled/unregistered) so the
    // token list doesn't grow stale forever.
    await Promise.all(
      result.responses.map((r, i) => {
        if (r.success) return null
        const code = r.error?.code
        if (code === 'messaging/registration-token-not-registered') {
          return db.collection('users').doc(uid).collection('pushTokens').doc(tokens[i]).delete()
        }
        return null
      }),
    )
  } catch (err) {
    console.error(`No se pudo enviar push a ${uid}:`, err)
  }
}
