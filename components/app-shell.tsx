'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useGame } from '@/lib/game-context'
import { registerServiceWorker } from '@/lib/register-service-worker'
import { onForegroundPush } from '@/lib/push-notifications'
import { AppSidebar } from '@/components/app-sidebar'
import { RewardOverlay } from '@/components/reward-overlay'
import { NotificationPrompt } from '@/components/notification-prompt'

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Resumen', subtitle: 'Tu progreso de un vistazo' },
  '/hobbies': { title: 'Hobbies', subtitle: 'Gestiona las habilidades que estás subiendo de nivel' },
  '/tareas': { title: 'Misiones diarias', subtitle: 'Completa tareas para ganar XP' },
  '/finanzas': { title: 'Finanzas', subtitle: 'Controla tu presupuesto mensual y tus gastos' },
  '/nutricion': { title: 'Nutrición', subtitle: 'Monitorea calorías, macros y hábitos saludables' },
  '/gym': { title: 'Gym', subtitle: 'Planifica entrenamientos, registra series y sigue tu progreso' },
  '/agua': { title: 'Hidratación', subtitle: 'Mantente hidratado y cumple tu meta diaria de agua' },
  '/ajustes': { title: 'Ajustes', subtitle: 'Cuenta y notificaciones' },
}

/** Persistent sidebar + top bar shell shared by every authenticated route. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useGame()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { title, subtitle } = TITLES[pathname] ?? TITLES['/']

  useEffect(() => {
    registerServiceWorker()
  }, [])

  // Restore the desktop sidebar's collapsed/expanded state. Read after mount
  // (not as the initial useState value) so server and first client render
  // match — a stored "true" only takes effect once hydration is done.
  useEffect(() => {
    const stored = window.localStorage.getItem('starklab-sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('starklab-sidebar-collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    // Background pushes are shown by the service worker automatically —
    // this only covers pushes that arrive while a tab already has focus,
    // which FCM does not auto-display.
    let unsubscribe: (() => void) | null = null
    onForegroundPush((title, body) => {
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon.svg' })
      }
    }).then((unsub) => {
      unsubscribe = unsub
    })
    return () => unsubscribe?.()
  }, [])

  return (
    <div className="min-h-dvh">
      <AppSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <div className={collapsed ? 'lg:pl-[76px]' : 'lg:pl-72'}>
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
          {/* Top bar */}
          <header className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-balance">
                {title}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pathname === '/' ? `Hola, ${user?.displayName ?? 'jugador'}` : subtitle}
              </p>
            </div>
          </header>

          <NotificationPrompt />

          {children}

          <footer className="pt-2 text-center text-xs text-muted-foreground">
            StarkLab · Instalable como app · Datos guardados en tu cuenta
          </footer>
        </div>
      </div>

      <RewardOverlay />
    </div>
  )
}
