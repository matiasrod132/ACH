'use client'

import { useEffect, useState } from 'react'
import { Bell, Droplets, X } from 'lucide-react'
import { useGame } from '@/lib/game-context'
import { registerPushToken } from '@/lib/push-notifications'

// Persists the "don't show this again" choice across sessions. A plain
// in-memory flag would also satisfy "hide for the session", but localStorage
// means a user who dismisses it once isn't asked again on their next visit
// either — closer to "never nag." Exported so Ajustes (Settings) can clear
// it after the user re-enables notifications from there, instead of a
// console command.
export const NOTIFICATION_PROMPT_DISMISSED_KEY = 'starklab:notification-prompt-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function persistDismissed() {
  try {
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, '1')
  } catch {
    // Storage unavailable (private browsing, etc.) — fail silently, the
    // banner just won't remember across reloads.
  }
}

/**
 * Small, dismissible inline banner that asks for notification permission.
 * Never shown automatically as a native browser prompt on load — only
 * appears as this in-page UI, and only when permission hasn't been decided
 * yet. Once the user grants, denies, or dismisses it, it hides itself for
 * good (localStorage-backed), so it never re-nags.
 *
 * Granting permission here enables both local reminders (lib/local-reminders.ts,
 * fired by this app's own JS while a tab is open) AND real background push
 * (registers an FCM token via lib/push-notifications.ts, so notifications
 * the Apps Script sends — e.g. "nuevo movimiento" — arrive even with the app
 * fully closed).
 */
export function NotificationPrompt() {
  const { user } = useGame()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (readDismissed()) return
    setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    persistDismissed()
  }

  async function handleEnable() {
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted' && user) {
        await registerPushToken(user.uid)
      }
    } catch {
      // Ignore — nothing actionable if the browser rejects the request.
    } finally {
      // Whatever the outcome (granted or denied), the decision is made —
      // hide the banner for good.
      dismiss()
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-water/12">
        <Bell className="size-4.5 text-water" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted-foreground">
          Activá notificaciones para tus movimientos y recordatorios — incluso con la app cerrada.
        </p>
      </div>

      <button
        type="button"
        onClick={handleEnable}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-water px-3 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
      >
        <Droplets className="size-3.5" aria-hidden="true" />
        Activar
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar aviso de notificaciones"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
