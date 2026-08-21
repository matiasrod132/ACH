// Local (foreground-only) notification primitives.
//
// IMPORTANT: these notifications only fire while the tab/PWA is actually
// open and running — they're scheduled with plain setTimeout/setInterval in
// client JS. This is NOT background push (which would keep working even if
// the app/tab is closed). True background push requires Firebase Cloud
// Messaging with a server-side sender, which requires the Firebase project
// to be on a paid "Blaze" plan — that's a billing decision outside the
// scope of this file, so it isn't implemented here.

/**
 * Shows a browser notification `delayMs` milliseconds from now, provided
 * notification permission has already been granted. No-ops otherwise
 * (including when `Notification` isn't supported at all).
 *
 * Returns the timeout id (so a caller could `clearTimeout` it to cancel),
 * or `null` if no notification will be scheduled.
 */
export function scheduleLocalReminder(
  title: string,
  body: string,
  delayMs: number,
): ReturnType<typeof setTimeout> | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }
  if (Notification.permission !== 'granted') {
    return null
  }

  return setTimeout(() => {
    // Guard again at fire-time in case permission changed while waiting.
    if (Notification.permission !== 'granted') return
    new Notification(title, { body, icon: '/icon.svg' })
  }, delayMs)
}

// Example of how another component could use this to nag about water every
// 2 hours while the app stays open (not wired into any screen yet — just
// illustrating the intended call pattern):
//
//   useEffect(() => {
//     const TWO_HOURS = 2 * 60 * 60 * 1000
//     const id = setInterval(() => {
//       scheduleLocalReminder(
//         'Hora de hidratarte',
//         'Sumá un vaso de agua a tu contador de hoy.',
//         0,
//       )
//     }, TWO_HOURS)
//     return () => clearInterval(id)
//   }, [])
