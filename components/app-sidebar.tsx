'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
  ChevronRight,
  ArrowLeftRight,
  Target,
  BarChart3,
  CalendarClock,
  Utensils,
  Scale,
  Play,
  CalendarDays,
  TrendingUp,
  Ruler,
} from 'lucide-react'
import { useGame } from '@/lib/game-context'

type NavLeaf = {
  href: string
  label: string
  icon: typeof LayoutGrid
  /** For a tab sub-item: the exact `?tab=` value this link selects. Active
   * state then depends on the URL's tab param, not just the pathname,
   * since the default tab's href omits the query entirely. */
  matchTab?: string
}
type NavGroup = { label: string; icon: typeof LayoutGrid; children: NavLeaf[] }
type NavNode = NavLeaf | NavGroup

function isLeaf(node: NavNode): node is NavLeaf {
  return 'href' in node
}

// Real routes only. The dropdown groups below are each page's own real
// tabs (see finance-dashboard.tsx, nutrition-section.tsx, gym-section.tsx)
// mirrored into the sidebar via `?tab=` deep links — not invented pages.
const NAV_TREE: NavNode[] = [
  { href: '/', label: 'Resumen', icon: LayoutGrid },
  { href: '/hobbies', label: 'Hobbies', icon: Sparkles },
  { href: '/tareas', label: 'Misiones diarias', icon: CircleCheckBig },
  {
    label: 'Finanzas',
    icon: Wallet,
    children: [
      { href: '/finanzas', label: 'Resumen', icon: LayoutGrid, matchTab: 'resumen' },
      { href: '/finanzas?tab=movimientos', label: 'Movimientos', icon: ArrowLeftRight, matchTab: 'movimientos' },
      { href: '/finanzas?tab=metas', label: 'Metas', icon: Target, matchTab: 'metas' },
      { href: '/finanzas?tab=reportes', label: 'Reportes', icon: BarChart3, matchTab: 'reportes' },
      { href: '/finanzas?tab=pagos', label: 'Pagos', icon: CalendarClock, matchTab: 'pagos' },
    ],
  },
  {
    label: 'Nutrición',
    icon: Salad,
    children: [
      { href: '/nutricion', label: 'Resumen', icon: LayoutGrid, matchTab: 'resumen' },
      { href: '/nutricion?tab=comidas', label: 'Comidas', icon: Utensils, matchTab: 'comidas' },
      { href: '/nutricion?tab=peso', label: 'Peso', icon: Scale, matchTab: 'peso' },
      { href: '/nutricion?tab=objetivos', label: 'Objetivos', icon: Target, matchTab: 'objetivos' },
    ],
  },
  {
    label: 'Gym',
    icon: Dumbbell,
    children: [
      { href: '/gym', label: 'Resumen', icon: LayoutGrid, matchTab: 'resumen' },
      { href: '/gym?tab=rutinas', label: 'Rutinas', icon: Dumbbell, matchTab: 'rutinas' },
      { href: '/gym?tab=registrar', label: 'Registrar', icon: Play, matchTab: 'registrar' },
      { href: '/gym?tab=historial', label: 'Historial', icon: CalendarDays, matchTab: 'historial' },
      { href: '/gym?tab=progreso', label: 'Progreso', icon: TrendingUp, matchTab: 'progreso' },
      { href: '/gym?tab=medidas', label: 'Medidas', icon: Ruler, matchTab: 'medidas' },
    ],
  },
  { href: '/agua', label: 'Hidratación', icon: Droplets },
]

// Icon-rail (collapsed desktop) mode: one row per top-level item, groups
// collapse to their default ("Resumen") tab since there's no room to
// expand nested rows in a ~76px rail.
const RAIL_NAV: NavLeaf[] = NAV_TREE.map((node) =>
  isLeaf(node) ? node : { href: node.children[0].href, label: node.label, icon: node.icon },
)

// Search palette: every real destination, tabs included, labeled with
// their group so e.g. "Movimientos" isn't ambiguous.
const SEARCH_NAV: NavLeaf[] = NAV_TREE.flatMap((node) =>
  isLeaf(node) ? [node] : node.children.map((child) => ({ ...child, label: `${node.label} · ${child.label}` })),
)

const BOTTOM_NAV: NavLeaf[] = [{ href: '/ajustes', label: 'Ajustes', icon: Settings }]

const GROUPS_STORAGE_KEY = 'starklab-sidebar-closed-groups'

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
  const searchParams = useSearchParams()
  const router = useRouter()
  const pct = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100))
  const pendingTasks = tasks.filter((t) => !t.done).length
  const activeTab = searchParams.get('tab') ?? 'resumen'

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Which dropdown groups the user has explicitly collapsed. Undefined /
  // missing means "open" — so groups default to open on first visit.
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROUPS_STORAGE_KEY)
      if (stored) setClosedGroups(JSON.parse(stored))
    } catch {
      // ignore malformed/unavailable storage
    }
  }, [])

  function toggleGroup(label: string) {
    setClosedGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try {
        window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...SEARCH_NAV, ...BOTTOM_NAV]
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

  function isActive(item: NavLeaf) {
    const targetPath = item.href.split('?')[0]
    if (item.matchTab) return pathname === targetPath && activeTab === item.matchTab
    return pathname === item.href
  }

  function renderLeaf(item: NavLeaf) {
    const active = isActive(item)
    const badge = item.href === '/tareas' && pendingTasks > 0 ? pendingTasks : null
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'} ${
          active
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon className="size-[17px] shrink-0" aria-hidden="true" />
          <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
  }

  function renderGroup(group: NavGroup) {
    const activeChild = group.children.some((c) => c.href.split('?')[0] === pathname)
    const open = !closedGroups[group.label] || activeChild
    const Icon = group.icon
    return (
      <div key={group.label} className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleGroup(group.label)}
          title={collapsed ? group.label : undefined}
          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
            activeChild ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-3">
            <Icon className="size-[17px] shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'lg:hidden' : ''}>{group.label}</span>
          </span>
          <ChevronRight
            className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${open ? 'rotate-90' : ''} ${collapsed ? 'lg:hidden' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${collapsed ? 'lg:hidden' : ''} ${
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden pl-[26px]">
            {group.children.map((leaf) => renderLeaf(leaf))}
          </div>
        </div>
      </div>
    )
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
        <nav className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {collapsed
            ? RAIL_NAV.map((leaf) => renderLeaf(leaf))
            : NAV_TREE.map((node) => (isLeaf(node) ? renderLeaf(node) : renderGroup(node)))}
        </nav>

        {/* Bottom nav + collapse toggle + sign out */}
        <div className="flex flex-col gap-0.5 border-t border-border/60 p-3">
          {BOTTOM_NAV.map((leaf) => renderLeaf(leaf))}
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
