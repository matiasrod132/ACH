'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
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
  Search,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
} from 'lucide-react'
import { useGame } from '@/lib/game-context'

type NavEntry = { href: string; label: string; icon: typeof LayoutGrid }

const NAV: NavEntry[] = [
  { href: '/', label: 'Resumen', icon: LayoutGrid },
  { href: '/hobbies', label: 'Hobbies', icon: Sparkles },
  { href: '/tareas', label: 'Misiones diarias', icon: CircleCheckBig },
  { href: '/finanzas', label: 'Finanzas', icon: Wallet },
  { href: '/nutricion', label: 'Nutrición', icon: Salad },
  { href: '/gym', label: 'Gym', icon: Dumbbell },
  { href: '/agua', label: 'Hidratación', icon: Droplets },
]

const BOTTOM_NAV: NavEntry[] = [{ href: '/ajustes', label: 'Ajustes', icon: Settings }]

export function AppSidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { user, signOut, level, xpInLevel, xpForLevel, tasks } = useGame()
  const pathname = usePathname()
  const router = useRouter()
  const pct = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100))
  const pendingTasks = tasks.filter((t) => !t.done).length

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...NAV, ...BOTTOM_NAV]
    if (!q) return all
    return all.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  function goTo(href: string) {
    router.push(href)
    setSearchOpen(false)
    onClose()
  }

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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card/60 backdrop-blur-xl transition-[transform,width] duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : 'w-72'}`}
      >
        {/* Brand */}
        <div className={`flex items-center gap-2.5 px-5 py-5 ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground">
              <Zap className="size-4 text-background" aria-hidden="true" />
            </span>
            <p
              className={`font-display text-[15px] font-semibold leading-none tracking-tight ${collapsed ? 'lg:hidden' : ''}`}
            >
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
        <div className={`mx-4 rounded-2xl bg-secondary/50 p-3.5 ${collapsed ? 'lg:mx-2 lg:p-2' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tasks/18 font-display text-xs font-semibold text-tasks">
              {(user?.displayName ?? 'P').slice(0, 1).toUpperCase()}
            </span>
            <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-[13px] font-medium">{user?.displayName ?? 'Jugador'}</p>
              <p className="text-[11px] text-muted-foreground">Nivel {level}</p>
            </div>
          </div>
          <div className={`mt-3 ${collapsed ? 'lg:hidden' : ''}`}>
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

        {/* Search */}
        <div className={`px-3 pt-3 ${collapsed ? 'lg:px-2' : ''}`}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}
          >
            <span className="flex items-center gap-3">
              <Search className="size-[17px] shrink-0" aria-hidden="true" />
              <span className={collapsed ? 'lg:hidden' : ''}>Buscar</span>
            </span>
            <kbd
              className={`hidden items-center justify-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/70 lg:inline-flex ${collapsed ? 'lg:hidden' : ''}`}
            >
              <Command className="size-2.5" aria-hidden="true" />K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-1 flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            const badge = href === '/tareas' && pendingTasks > 0 ? pendingTasks : null
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'} ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-[17px] shrink-0" aria-hidden="true" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                </span>
                {badge !== null && (
                  <span
                    className={`grid min-w-5 place-items-center rounded-full bg-tasks/18 px-1.5 py-0.5 text-[10px] font-semibold text-tasks ${collapsed ? 'lg:hidden' : ''}`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom nav + collapse toggle + sign out */}
        <div className="flex flex-col gap-0.5 border-t border-border/60 p-3">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Icon className="size-[17px] shrink-0" aria-hidden="true" />
                <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => signOut()}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut className="size-[17px] shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'lg:hidden' : ''}>Cerrar sesión</span>
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-1 hidden items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground lg:flex lg:justify-center"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[17px] shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-[17px] shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>

      {/* Search palette */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[15vh] backdrop-blur-sm">
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={() => setSearchOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-[18px] shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) goTo(results[0].href)
                }}
                placeholder="Ir a Finanzas, Gym, Ajustes…"
                className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <kbd className="hidden shrink-0 items-center justify-center rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/70 sm:inline-flex">
                ESC
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
              )}
              {results.map(({ href, label, icon: Icon }) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => goTo(href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/60"
                >
                  <Icon className="size-[16px] text-muted-foreground" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
