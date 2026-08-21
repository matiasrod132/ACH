'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { CalendarDays, CircleCheckBig, Droplets, Dumbbell, Wallet } from 'lucide-react'
import { useMovements } from '@/lib/movements'
import { fetchWaterHistory } from '@/lib/nutrition'
import { fetchWorkouts } from '@/lib/gym'
import { useGame } from '@/lib/game-context'
import { dateToISO, formatCurrency } from '@/lib/format'

type Tone = 'finance' | 'water' | 'gym' | 'tasks'

const TONE_CLASSES: Record<Tone, { badge: string; text: string }> = {
  finance: { badge: 'bg-finance/12', text: 'text-finance' },
  water: { badge: 'bg-water/12', text: 'text-water' },
  gym: { badge: 'bg-gym/12', text: 'text-gym' },
  tasks: { badge: 'bg-tasks/12', text: 'text-tasks' },
}

/** ISO date string N days back from today (inclusive window helper). */
function daysAgoISO(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return dateToISO(d)
}

/**
 * Flagship cross-module retention card: summarizes the user's last 7 days across
 * Finanzas, Hidratación, Gym and Tareas in a single glance. Self-contained —
 * fetches/derives everything itself from `uid`, matching each module's own
 * established SWR call style so it stays in sync with live data.
 */
export function WeeklyRecap({ uid }: { uid: string }) {
  const { data: movements, isLoading: movementsLoading } = useMovements(uid)
  const { data: waterHistory, isLoading: waterLoading } = useSWR(
    uid ? ['waterHistory', uid] : null,
    () => fetchWaterHistory(uid),
  )
  const { data: workouts, isLoading: workoutsLoading } = useSWR(
    uid ? ['workouts', uid] : null,
    () => fetchWorkouts(uid),
  )
  const { tasks } = useGame()

  // Últimos 7 días incluyendo hoy (hoy - 6 hasta hoy).
  const cutoff = useMemo(() => daysAgoISO(6), [])

  const totalSpent = useMemo(() => {
    if (!movements) return 0
    return movements
      .filter((m) => m.type === 'expense' && m.date >= cutoff)
      .reduce((sum, m) => sum + m.amount, 0)
  }, [movements, cutoff])

  const avgWater = useMemo(() => {
    if (!waterHistory) return 0
    const recent = waterHistory.filter((w) => w.date >= cutoff)
    if (recent.length === 0) return 0
    return recent.reduce((sum, w) => sum + w.cups, 0) / recent.length
  }, [waterHistory, cutoff])

  const workoutCount = useMemo(() => {
    if (!workouts) return 0
    return workouts.filter((w) => w.date >= cutoff).length
  }, [workouts, cutoff])

  // `Task` (lib/game-context.tsx) no tiene campo de fecha, solo `done` — así
  // que este porcentaje refleja las tareas actuales en conjunto, no una
  // ventana estricta de 7 días (el modelo de datos no permite acotarlo).
  const taskCompletionPct = useMemo(() => {
    if (tasks.length === 0) return 0
    return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
  }, [tasks])

  const anyLoading = movementsLoading || waterLoading || workoutsLoading

  const noDataAtAll =
    !anyLoading &&
    (movements?.length ?? 0) === 0 &&
    (waterHistory?.length ?? 0) === 0 &&
    (workouts?.length ?? 0) === 0 &&
    tasks.length === 0

  if (noDataAtAll) {
    return (
      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <header className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-tasks/12">
            <CalendarDays className="size-5 text-tasks" aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-semibold tracking-tight">Resumen semanal</h2>
        </header>
        <p className="mt-3 text-sm text-muted-foreground">
          Todavía no hay actividad registrada. Empieza a usar StarkLab y tu resumen semanal aparecerá aquí.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-tasks/12">
          <CalendarDays className="size-5 text-tasks" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Resumen semanal</h2>
          <p className="text-sm text-muted-foreground">Tus últimos 7 días en un vistazo</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={Wallet}
          tone="finance"
          label="Gastado"
          value={movementsLoading ? null : formatCurrency(totalSpent)}
        />
        <StatTile
          icon={Droplets}
          tone="water"
          label="Agua (prom/día)"
          value={waterLoading ? null : `${avgWater.toFixed(1)} vasos`}
        />
        <StatTile
          icon={Dumbbell}
          tone="gym"
          label="Entrenamientos"
          value={workoutsLoading ? null : `${workoutCount}`}
        />
        <StatTile
          icon={CircleCheckBig}
          tone="tasks"
          label="Tareas completadas"
          value={`${taskCompletionPct}%`}
        />
      </div>
    </section>
  )
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Wallet
  tone: Tone
  label: string
  value: string | null
}) {
  const { badge, text } = TONE_CLASSES[tone]

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-3.5">
      <span className={`grid size-8 place-items-center rounded-lg ${badge}`}>
        <Icon className={`size-4 ${text}`} aria-hidden="true" />
      </span>
      <div>
        <p className="font-mono text-base font-semibold tabular-nums">
          {value ?? <span className="text-muted-foreground">…</span>}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
