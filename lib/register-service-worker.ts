// Framework-agnostic helper to register the app's service worker
// (public/sw.js). Meant to be called once, e.g. from a `useEffect` in the
// root layout:
//
//   useEffect(() => {
//     registerServiceWorker()
//   }, [])
//
// Safe to call in any environment: no-ops (with a console.warn) if service
// workers aren't supported or registration fails for any reason. Never
// throws.
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.warn('Service worker registration failed:', error)
  })
}
