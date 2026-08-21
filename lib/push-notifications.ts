import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseApp, db } from '@/lib/firebase'

/**
 * Real background push (Firebase Cloud Messaging). Unlike lib/local-reminders.ts,
 * these arrive even with the app/tab fully closed — the send side lives in
 * apps-script/Code.gs (enviarPush_), which calls FCM's v1 API using the same
 * free ScriptApp.getOAuthToken() the bank-sync script already uses. No Cloud
 * Functions, no Blaze billing plan required — sending FCM messages via the
 * HTTP v1 API is free regardless of Firebase plan; only Cloud Functions (a
 * different way to trigger sends) requires Blaze, and this app doesn't use one.
 */

let messagingPromise: ReturnType<typeof loadMessaging> | null = null

async function loadMessaging() {
  if (typeof window === 'undefined' || !firebaseApp) return null
  const { isSupported, getMessaging } = await import('firebase/messaging')
  if (!(await isSupported())) return null
  return getMessaging(firebaseApp)
}

function getMessagingInstance() {
  if (!messagingPromise) messagingPromise = loadMessaging()
  return messagingPromise
}

/**
 * Requests a push permission + FCM device token and saves it to
 * `users/{uid}/pushTokens/{token}`. Call this only after the user has
 * explicitly granted Notification permission (e.g. right after
 * `Notification.requestPermission()` resolves to "granted").
 *
 * Returns the token on success, or null if push isn't supported/configured
 * (missing VAPID key, unsupported browser, no service worker, etc.) — callers
 * should treat null as "local notifications still work, background push doesn't".
 */
export async function registerPushToken(uid: string): Promise<string | null> {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey || !db) return null

    const messaging = await getMessagingInstance()
    if (!messaging) return null

    const registration = await navigator.serviceWorker.ready
    const { getToken } = await import('firebase/messaging')
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return null

    await setDoc(doc(db, 'users', uid, 'pushTokens', token), {
      token,
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent,
    })

    return token
  } catch (err) {
    console.warn('No se pudo registrar el token de notificaciones push:', err)
    return null
  }
}

/**
 * Shows a notification for pushes that arrive while the app is in the
 * foreground — FCM does not auto-display those (only background pushes are
 * shown automatically by the service worker). Returns the unsubscribe
 * function, or null if messaging isn't available.
 */
export async function onForegroundPush(
  handler: (title: string, body: string) => void,
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance()
  if (!messaging) return null

  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'StarkLab'
    const body = payload.notification?.body ?? ''
    handler(title, body)
  })
}
