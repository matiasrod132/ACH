// Minimal service worker for StarkLab.
//
// Scope: basic installability + a graceful offline fallback for navigations.
// This is intentionally NOT an offline-first rewrite: only the app shell
// (`/` and `/manifest.json`) is precached, and only navigation requests get
// a network-first-falling-back-to-cache strategy. Everything else (hashed
// build assets, API calls, images, etc.) passes straight through to the
// network with no caching, since Next.js build asset filenames change per
// build and hardcoding them here would be brittle and risky.
//
// Also handles real background push via Firebase Cloud Messaging (see the
// firebase.initializeApp/onBackgroundMessage block below) — the send side
// lives in apps-script/Code.gs (enviarPush_), using the free FCM v1 HTTP API
// with the script's own OAuth token, no Cloud Functions/Blaze plan needed.
// Purely local (foreground-only, no server) reminders also still exist
// separately — see lib/local-reminders.ts.

// Firebase Cloud Messaging — background push handling.
//
// Config values below are the standard Firebase Web SDK config (apiKey,
// projectId, etc.) — these are public client identifiers by design (they
// ship in every Firebase web app's JS bundle already); security comes from
// Firestore rules, never from hiding these. A service worker is a static
// file with no access to Next.js env vars at runtime, so they're inlined
// here to match lib/firebase.ts's config (kept in sync manually — update
// both if the Firebase project ever changes).
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyB3DAgh7yhH0Vw0AvgvZIIYu_g_ClMDhCk',
  authDomain: 'chat-8ada6.firebaseapp.com',
  projectId: 'chat-8ada6',
  storageBucket: 'chat-8ada6.appspot.com',
  messagingSenderId: '118276457185',
  appId: '1:118276457185:web:ee2f6f69c2d9a332aeeda0',
})

const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null

// Fires for pushes that arrive while no app tab has focus — foreground
// pushes are handled instead by lib/push-notifications.ts's onForegroundPush,
// since FCM does not auto-display foreground messages.
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'StarkLab'
    const body = payload.notification?.body || ''
    self.registration.showNotification(title, { body, icon: '/icon.svg' })
  })
}

const CACHE_NAME = 'starklab-shell-v1'
const APP_SHELL = ['/', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Best-effort precache; never block installation on it.
      }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GET requests; let everything else (POST,
  // cross-origin API/Firebase calls, etc.) pass through untouched.
  if (request.method !== 'GET') return

  // Navigation requests: network-first, falling back to the cached shell
  // (and finally to the cached '/') so a lost connection shows the app's
  // own offline state instead of a browser error page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match(request)) || (await cache.match('/'))
        }),
    )
    return
  }

  // Everything else: pass through, no caching.
})
