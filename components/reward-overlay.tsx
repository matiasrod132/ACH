'use client'

import { Zap, Trophy } from 'lucide-react'
import { useGame } from '@/lib/game-context'

export function RewardOverlay() {
  const { rewards } = useGame()

  const levelUps = rewards.filter((r) => r.kind === 'levelup')
  const xpEvents = rewards.filter((r) => r.kind === 'xp')

  return (
    <>
      {/* Floating XP toasts (bottom center, stacked) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2">
        {xpEvents.map((r) => (
          <div
            key={r.id}
            className="animate-xp-pop flex items-center gap-2 rounded-full border border-neon-indigo/40 bg-card/90 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur"
          >
            <Zap className="size-4 text-neon-indigo" aria-hidden="true" />
            <span className="text-neon-indigo">+{r.amount} XP</span>
            {r.message && <span className="text-muted-foreground">{r.message}</span>}
          </div>
        ))}
      </div>

      {/* Level-up celebration (center) */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        {levelUps.map((r) => (
          <div
            key={r.id}
            className="animate-level-up glass glow-indigo relative flex flex-col items-center gap-3 rounded-3xl px-10 py-8 text-center"
          >
            <span className="grid size-16 place-items-center rounded-2xl bg-neon-indigo/15 ring-1 ring-neon-indigo/40">
              <Trophy className="size-8 text-neon-indigo" aria-hidden="true" />
            </span>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Subiste de nivel
            </p>
            <p className="font-display text-4xl font-bold text-gradient">Nivel {r.level}</p>
            <p className="text-sm text-muted-foreground">Estás que ardes — mantén viva la racha.</p>
            <Confetti />
          </div>
        ))}
      </div>
    </>
  )
}

function Confetti() {
  const pieces = Array.from({ length: 14 })
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2
        const dist = 90 + (i % 3) * 30
        const bx = `${Math.cos(angle) * dist}px`
        const by = `${Math.sin(angle) * dist}px`
        const colors = ['bg-neon-indigo', 'bg-neon-emerald', 'bg-neon-blue']
        return (
          <span
            key={i}
            className={`animate-burst absolute left-1/2 top-1/2 size-2 rounded-sm ${colors[i % 3]}`}
            style={{ ['--bx' as string]: bx, ['--by' as string]: by }}
          />
        )
      })}
    </div>
  )
}
