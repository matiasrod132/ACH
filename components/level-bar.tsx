'use client'

import { Zap } from 'lucide-react'
import { useGame } from '@/lib/game-context'

export function LevelBar() {
  const { level, xpInLevel, xpForLevel, totalXp } = useGame()
  const pct = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100))

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-tasks/15">
            <span className="font-display text-lg font-bold text-tasks">{level}</span>
          </span>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              Aficionado nivel {level}
            </p>
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {xpInLevel} / {xpForLevel} XP para el nivel {level + 1}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-sm font-medium">
          <Zap className="size-4 text-tasks" aria-hidden="true" />
          <span className="font-mono tabular-nums">{totalXp.toLocaleString()}</span>
          <span className="text-muted-foreground">XP total</span>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/70"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del nivel ${level}`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-tasks transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
