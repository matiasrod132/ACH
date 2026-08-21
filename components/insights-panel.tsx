'use client'

import { useMemo, type ReactNode } from 'react'
import useSWR from 'swr'
import { Lightbulb, Wallet, Droplets, Scale, type LucideIcon } from 'lucide-react'
import { useMovements } from '@/lib/movements'
import { fetchWorkouts } from '@/lib/gym'
import { fetchWaterHistory, fetchWeightEntries } from '@/lib/nutrition'
import { formatCurrency, dateToISO } from '@/lib/format'

/**
 * Cross-module insights: real correlations computed from the user's own
 * historical data across finance, gym, water and weight — never fabricated.
 * Each insight is skipped (not shown with a placeholder/fake number) when
 * there isn't enough history yet to compute it honestly.
 *
 * Note on scope: the original brief for insight #2 asked for "task
 * completion vs. hidratación", but `Task` (lib/game-context.tsx) has no
 * date field — it's a persistent checklist with a single global `done`
 * flag, not a per-day completion log — so a day-by-day correlation against
 * it can't be computed honestly for any user. "Hidratación en días de
 * entrenamiento vs. sin entrenar" is used instead: both signals (water,
 * workouts) are genuinely dated per-day records.
 */

const LOOKBACK_DAYS = 90
const MIN_DAYS_PER_GROUP = 5
const MIN_FOOD_ENTRIES = 5
const MIN_WEIGHT_WEEKS = 5
const MIN_PCT_DELTA = 0.03 // ignore differences under 3% — noise, not a pattern

type Accent = 'finance' | 'water' | 'gym'

interface Insight {
  id: string
  icon: LucideIcon
  accent: Accent
  node: ReactNode
}

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateToISO(d)
}

function enumerateDates(startISO: string, endISO: string): string[] {
  const [sy, sm, sd] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  const cur = new Date(sy, (sm || 1) - 1, sd)
  const end = new Date(ey, (em || 1) - 1, ed)
  const dates: string[] = []
  while (cur.getTime() <= end.getTime()) {
    dates.push(dateToISO(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Buckets a date into a stable ~7-day period (not calendar-aligned to
 * Monday) — only used to compare week-over-week deltas consistently. */
function weekBucket(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  return Math.floor(new Date(y, (m || 1) - 1, d).getTime() / (7 * 86400000))
}

export function InsightsPanel({ uid }: { uid: string }) {
  const { data: movements } = useMovements(uid)
  const { data: workouts } = useSWR(['workouts', uid], () => fetchWorkouts(uid))
  const { data: waterHistory } = useSWR(['waterHistory', uid], () => fetchWaterHistory(uid))
  const { data: weightEntries } = useSWR(['weight', uid], () => fetchWeightEntries(uid))

  const loading = !movements || !workouts || !waterHistory || !weightEntries

  const insights = useMemo<Insight[]>(() => {
    if (!movements || !workouts || !waterHistory || !weightEntries) return []

    const cutoff = daysAgoISO(LOOKBACK_DAYS)
    const today = dateToISO(new Date())
    const result: Insight[] = []

    const workoutDatesInWindow = workouts.map((w) => w.date).filter((d) => d >= cutoff)
    const workoutDateSet = new Set(workoutDatesInWindow)

    /* ---- 1. Gasto en comida: días de entrenamiento vs. sin entrenar ---- */
    const foodMovements = movements.filter(
      (m) => m.type === 'expense' && m.category.includes('Comida') && m.date >= cutoff,
    )
    if (foodMovements.length >= MIN_FOOD_ENTRIES && workoutDateSet.size >= MIN_DAYS_PER_GROUP) {
      const activityDates = [...movements.map((m) => m.date), ...workoutDatesInWindow].filter((d) => d >= cutoff)
      const earliest = activityDates.length ? activityDates.reduce((a, b) => (a < b ? a : b)) : cutoff
      const start = earliest > cutoff ? earliest : cutoff
      const days = enumerateDates(start, today)

      const spendByDay = new Map<string, number>()
      for (const m of foodMovements) {
        spendByDay.set(m.date, (spendByDay.get(m.date) ?? 0) + m.amount)
      }

      const workoutSpend: number[] = []
      const restSpend: number[] = []
      for (const day of days) {
        const spend = spendByDay.get(day) ?? 0
        if (workoutDateSet.has(day)) workoutSpend.push(spend)
        else restSpend.push(spend)
      }

      if (workoutSpend.length >= MIN_DAYS_PER_GROUP && restSpend.length >= MIN_DAYS_PER_GROUP) {
        const avgWorkout = mean(workoutSpend)
        const avgRest = mean(restSpend)
        if (avgRest > 0 && Math.abs(avgWorkout - avgRest) / avgRest >= MIN_PCT_DELTA) {
          const pct = Math.round((Math.abs(avgWorkout - avgRest) / avgRest) * 100)
          const less = avgWorkout < avgRest
          result.push({
            id: 'food-vs-workout',
            icon: Wallet,
            accent: 'finance',
            node: (
              <>
                Gastás <span className="font-mono">{pct}%</span> {less ? 'menos' : 'más'} en comida los días que
                entrenás{' '}
                <span className="text-muted-foreground">
                  ({formatCurrency(avgWorkout)} vs. {formatCurrency(avgRest)} promedio/día)
                </span>
                .
              </>
            ),
          })
        }
      }
    }

    /* ---- 2. Hidratación: días de entrenamiento vs. sin entrenar ---- */
    const waterInWindow = waterHistory.filter((w) => w.date >= cutoff)
    const waterWorkout = waterInWindow.filter((w) => workoutDateSet.has(w.date)).map((w) => w.cups)
    const waterRest = waterInWindow.filter((w) => !workoutDateSet.has(w.date)).map((w) => w.cups)
    if (waterWorkout.length >= MIN_DAYS_PER_GROUP && waterRest.length >= MIN_DAYS_PER_GROUP) {
      const avgWorkout = mean(waterWorkout)
      const avgRest = mean(waterRest)
      if (avgRest > 0 && Math.abs(avgWorkout - avgRest) / avgRest >= MIN_PCT_DELTA) {
        const pct = Math.round((Math.abs(avgWorkout - avgRest) / avgRest) * 100)
        const more = avgWorkout > avgRest
        result.push({
          id: 'water-vs-workout',
          icon: Droplets,
          accent: 'water',
          node: (
            <>
              Tomás <span className="font-mono">{pct}%</span> {more ? 'más' : 'menos'} agua los días que entrenás{' '}
              <span className="text-muted-foreground">
                ({avgWorkout.toFixed(1)} vs. {avgRest.toFixed(1)} vasos promedio)
              </span>
              .
            </>
          ),
        })
      }
    }

    /* ---- 3. Peso vs. frecuencia de entrenamiento semanal (opcional) ---- */
    const weightByWeek = new Map<number, number[]>()
    for (const w of weightEntries) {
      const key = weekBucket(w.date)
      if (!weightByWeek.has(key)) weightByWeek.set(key, [])
      weightByWeek.get(key)!.push(w.weightKg)
    }
    const weeklyAvg = [...weightByWeek.entries()]
      .map(([week, vals]) => ({ week, avg: mean(vals) }))
      .sort((a, b) => a.week - b.week)

    if (weeklyAvg.length >= MIN_WEIGHT_WEEKS) {
      const workoutsByWeek = new Map<number, number>()
      for (const w of workouts) {
        const key = weekBucket(w.date)
        workoutsByWeek.set(key, (workoutsByWeek.get(key) ?? 0) + 1)
      }

      const activeDeltas: number[] = []
      const inactiveDeltas: number[] = []
      for (let i = 1; i < weeklyAvg.length; i++) {
        const delta = weeklyAvg[i].avg - weeklyAvg[i - 1].avg
        const workoutsThisWeek = workoutsByWeek.get(weeklyAvg[i].week) ?? 0
        if (workoutsThisWeek >= 2) activeDeltas.push(delta)
        else inactiveDeltas.push(delta)
      }

      if (activeDeltas.length >= 2 && inactiveDeltas.length >= 2) {
        const avgActive = mean(activeDeltas)
        const avgInactive = mean(inactiveDeltas)
        const diff = avgActive - avgInactive
        if (Math.abs(diff) >= 0.05) {
          result.push({
            id: 'weight-vs-workout',
            icon: Scale,
            accent: 'gym',
            node: (
              <>
                Las semanas que entrenás 2 o más veces, tu peso {diff < 0 ? 'baja' : 'sube'}{' '}
                <span className="font-mono">{Math.abs(diff).toFixed(1)} kg</span> más en promedio que en las semanas
                con menos entrenamiento.
              </>
            ),
          })
        }
      }
    }

    return result
  }, [movements, workouts, waterHistory, weightEntries])

  if (loading) return null

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Todavía no hay suficientes datos para encontrar patrones — seguí registrando y volvé en unas semanas.
        </p>
      </div>
    )
  }

  const accentBg: Record<Accent, string> = {
    finance: 'bg-finance/12',
    water: 'bg-water/12',
    gym: 'bg-gym/12',
  }
  const accentText: Record<Accent, string> = {
    finance: 'text-finance',
    water: 'text-water',
    gym: 'text-gym',
  }

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-secondary">
          <Lightbulb className="size-5 text-foreground" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Patrones</h2>
          <p className="text-sm text-muted-foreground">Cruces entre tus módulos que solo esta app puede ver.</p>
        </div>
      </header>

      <ul className="flex flex-col gap-2.5">
        {insights.map((insight) => {
          const Icon = insight.icon
          return (
            <li key={insight.id} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3.5">
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${accentBg[insight.accent]}`}>
                <Icon className={`size-4 ${accentText[insight.accent]}`} aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed">{insight.node}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
