'use client'

import { useState } from 'react'
import { Check, Plus, Zap } from 'lucide-react'
import { useGame } from '@/lib/game-context'
import { getHobbyIcon, COLOR_MAP } from '@/lib/hobby-visuals'

export function TaskChecklist() {
  const { hobbies, tasks, toggleTask, addTask } = useGame()
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function submitTask(hobbyId: string) {
    const label = draft.trim()
    if (!label) return
    addTask(hobbyId, label)
    setDraft('')
    setAddingFor(null)
  }

  const totalDone = tasks.filter((t) => t.done).length

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Lista diaria</h2>
          <p className="text-sm text-muted-foreground">Cada tarea marcada otorga +10 XP al instante.</p>
        </div>
        <span className="rounded-full bg-secondary/60 px-3 py-1.5 font-mono text-sm font-medium tabular-nums">
          {totalDone}/{tasks.length} hechas
        </span>
      </header>

      <div className="flex flex-col gap-5">
        {hobbies.map((h) => {
          const Icon = getHobbyIcon(h.icon)
          const c = COLOR_MAP[h.color]
          const group = tasks.filter((t) => t.hobbyId === h.id)
          return (
            <div key={h.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`grid size-6 place-items-center rounded-md ${c.bg}`}>
                  <Icon className={`size-3.5 ${c.text}`} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{h.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddingFor(addingFor === h.id ? null : h.id)
                    setDraft('')
                  }}
                  aria-label={`Agregar tarea a ${h.name}`}
                  className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>

              <ul className="flex flex-col gap-1.5">
                {group.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggleTask(t.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-border hover:bg-secondary/40 ${
                        t.done ? 'opacity-60' : ''
                      }`}
                    >
                      <span
                        className={`relative grid size-6 shrink-0 place-items-center rounded-md border transition-all ${
                          t.done
                            ? `border-transparent ${c.bar} text-primary-foreground`
                            : 'border-border bg-secondary/40'
                        }`}
                      >
                        {t.done && <Check className="size-4" aria-hidden="true" />}
                        {t.done && <Burst colorClass={c.dot} />}
                      </span>
                      <span className={`flex-1 text-sm ${t.done ? 'line-through' : ''}`}>
                        {t.label}
                      </span>
                      <span
                        className={`flex items-center gap-0.5 text-xs font-medium ${c.text} transition-opacity ${
                          t.done ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Zap className="size-3" aria-hidden="true" />
                        +10
                      </span>
                    </button>
                  </li>
                ))}

                {addingFor === h.id && (
                  <li className="flex items-center gap-2 px-1 py-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitTask(h.id)
                        if (e.key === 'Escape') setAddingFor(null)
                      }}
                      placeholder="Nueva tarea…"
                      className="h-9 flex-1 rounded-lg border border-input bg-secondary/40 px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-tasks/60 focus:ring-2 focus:ring-tasks/15"
                    />
                    <button
                      type="button"
                      onClick={() => submitTask(h.id)}
                      className="inline-flex h-9 items-center rounded-lg bg-tasks px-3 text-sm font-medium text-primary-foreground hover:brightness-110"
                    >
                      Agregar
                    </button>
                  </li>
                )}

                {group.length === 0 && addingFor !== h.id && (
                  <li className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                    Aún no hay tareas.
                  </li>
                )}
              </ul>
            </div>
          )
        })}

        {hobbies.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Agrega un hobby para empezar tu lista de tareas.
          </p>
        )}
      </div>
    </section>
  )
}

function Burst({ colorClass }: { colorClass: string }) {
  const pieces = Array.from({ length: 6 })
  return (
    <span className="pointer-events-none absolute inset-0">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2
        const bx = `${Math.cos(angle) * 16}px`
        const by = `${Math.sin(angle) * 16}px`
        return (
          <span
            key={i}
            className={`animate-burst absolute left-1/2 top-1/2 size-1.5 rounded-full ${colorClass}`}
            style={{ ['--bx' as string]: bx, ['--by' as string]: by }}
          />
        )
      })}
    </span>
  )
}
