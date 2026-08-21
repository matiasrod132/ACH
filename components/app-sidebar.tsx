'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap,
  LogOut,
  LayoutGrid,
  Sparkles,
  CircleCheckBig,
  Wallet,
  Salad,
  Droplets,
  Dumbbell,
  Settings,
  X,
} from 'lucide-react'
import { useGame } from '@/lib/game-context'

const NAV: { href: string; label: string; icon: typeof LayoutGrid }[] = [
  { href: '/', label: 'Resumen', icon: LayoutGrid },
  { href: '/hobbies', label: 'Hobbies', icon: Sparkles },
  { href: '/tareas', label: 'Misiones diarias', icon: CircleCheckBig },
  { href: '/finanzas', label: 'Finanzas', icon: Wallet },
  { href: '/nutricion', label: 'Nutrición', icon: Salad },
  { href: '/gym', label: 'Gym', icon: Dumbbell },
  { href: '/agua', label: 'Hidratación', icon: Droplets },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, signOut, level, xpInLevel, xpForLevel } = useGame()
  const pathname = usePathname()
  const pct = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100))

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card/60 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-foreground">
              <Zap className="size-4 text-background" aria-hidden="true" />
            </span>
            <p className="font-display text-[15px] font-semibold leading-none tracking-tight">
              StarkLab
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Player card */}
        <div className="mx-4 rounded-2xl bg-secondary/50 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-tasks/18 font-display text-xs font-semibold text-tasks">
              {(user?.displayName ?? 'P').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{user?.displayName ?? 'Jugador'}</p>
              <p className="text-[11px] text-muted-foreground">Nivel {level}</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-tasks transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {xpInLevel} / {xpForLevel} XP
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-5 flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Icon className="size-[17px]" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
