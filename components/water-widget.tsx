'use client'

import useSWR from 'swr'
import { Droplet, Plus, RotateCcw } from 'lucide-react'
import { useGame } from '@/lib/game-context'
import { fetchWaterHistory, setWaterCups, type WaterDay } from '@/lib/nutrition'
import { todayISO } from '@/lib/format'

const TARGET = 8

function upsertDay(history: WaterDay[], date: string, cups: number): WaterDay[] {
  if (history.some((d) => d.date === date)) {
    return history.map((d) => (d.date === date ? { ...d, cups } : d))
  }
  return [{ date, cups }, ...history]
}

export function WaterWidget() {
  const { user, awardXp } = useGame()
  const uid = user!.uid
  const today = todayISO()

  const { data: history, mutate } = useSWR(['waterHistory', uid], () => fetchWaterHistory(uid))
  const waterCups = history?.find((d) => d.date === today)?.cups ?? 0
  const pct = Math.min(100, (waterCups / TARGET) * 100)
  const complete = waterCups >= TARGET

  async function addWater() {
    if (waterCups >= TARGET) return
    const next = waterCups + 1
    const nextHistory = upsertDay(history ?? [], today, next)
    await mutate(
      async () => {
        await setWaterCups(uid, today, next)
        return nextHistory
      },
      { optimisticData: nextHistory, rollbackOnError: true, revalidate: false },
    )
    awardXp(5, 'Hidratación +1 vaso')
  }

  async function resetWater() {
    const nextHistory = upsertDay(history ?? [], today, 0)
    await mutate(
      async () => {
        await setWaterCups(uid, today, 0)
        return nextHistory
      },
      { optimisticData: nextHistory, rollbackOnError: true, revalidate: false },
    )
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <header className="mb-5 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-water/12">
          <Droplet className="size-5 text-water" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Hidratación</h2>
          <p className="text-sm text-muted-foreground">Meta de {TARGET} vasos al día.</p>
        </div>
      </header>

      <div className="flex items-center gap-5">
        {/* Fluid gauge */}
        <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-water/10">
          <div className="absolute inset-0 bg-secondary/50" />
          <div
            className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
            style={{ height: `${pct}%` }}
          >
            {/* animated wave surface */}
            <div className="relative h-full w-full overflow-hidden">
              <div
                className="animate-water-wave absolute -top-2 left-0 h-4 w-[200%]"
                style={{
                  background:
                    'radial-gradient(circle at 25% 0, transparent 8px, var(--accent-water) 9px) repeat-x',
                  backgroundSize: '32px 32px',
                  opacity: 0.9,
                }}
              />
              <div
                className="h-full w-full"
                style={{
                  background:
                    'linear-gradient(180deg, var(--accent-water), color-mix(in oklch, var(--accent-water) 60%, var(--accent-tasks)))',
                }}
              />
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold tabular-nums drop-shadow">
              {waterCups}
            </span>
            <span className="text-xs text-foreground/80">/ {TARGET} vasos</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {Array.from({ length: TARGET }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < waterCups ? 'bg-water' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {complete ? 'Meta cumplida. Buena racha de hidratación.' : `Faltan ${TARGET - waterCups} vasos.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addWater}
              disabled={complete}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-water text-sm font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden="true" />
              +1 vaso
            </button>
            <button
              type="button"
              onClick={resetWater}
              aria-label="Reiniciar hidratación"
              className="grid size-10 place-items-center rounded-xl border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
