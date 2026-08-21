'use client'

import { useMemo, useState } from 'react'
import { Wallet, TrendingUp, Plus } from 'lucide-react'
import { useGame } from '@/lib/game-context'
import { getHobbyIcon, COLOR_MAP } from '@/lib/hobby-visuals'

export function ExpenseMonitor() {
  const { hobbies, expenses, addExpense } = useGame()
  const [hobbyId, setHobbyId] = useState(hobbies[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const activeHobbyId = hobbies.some((h) => h.id === hobbyId) ? hobbyId : hobbies[0]?.id ?? ''

  const monthStart = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }, [])

  const monthExpenses = expenses.filter((e) => e.date >= monthStart)
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0)

  const perHobby = hobbies
    .map((h) => ({
      hobby: h,
      amount: monthExpenses.filter((e) => e.hobbyId === h.id).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  function submit() {
    const value = Number.parseFloat(amount)
    if (!activeHobbyId || !Number.isFinite(value) || value <= 0) return
    addExpense(activeHobbyId, Math.round(value * 100) / 100, note.trim() || 'Gasto')
    setAmount('')
    setNote('')
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <header className="mb-5 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
          <Wallet className="size-5 text-finance" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Monitor de gastos</h2>
          <p className="text-sm text-muted-foreground">Controla cuánto te cuestan tus hobbies.</p>
        </div>
      </header>

      {/* Summary */}
      <div className="mb-5 rounded-2xl bg-finance/8 p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <TrendingUp className="size-4 text-finance" aria-hidden="true" />
          Total invertido este mes
        </div>
        <p className="mt-1 font-display font-mono text-4xl font-bold tracking-tight tabular-nums">
          ${total.toFixed(2)}
        </p>

        {perHobby.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {perHobby.map(({ hobby, amount }) => {
              const c = COLOR_MAP[hobby.color]
              const Icon = getHobbyIcon(hobby.icon)
              const pct = total > 0 ? Math.round((amount / total) * 100) : 0
              return (
                <li key={hobby.id} className="flex items-center gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${c.bg}`}>
                    <Icon className={`size-4 ${c.text}`} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{hobby.name}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        ${amount.toFixed(0)} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${c.bar} transition-[width] duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Quick entry */}
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <select
            value={activeHobbyId}
            onChange={(e) => setHobbyId(e.target.value)}
            aria-label="Hobby"
            className="h-11 flex-1 rounded-xl border border-input bg-secondary/40 px-3 text-sm outline-none focus:border-finance/60 focus:ring-2 focus:ring-finance/20"
          >
            {hobbies.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Monto"
              className="h-11 w-full rounded-xl border border-input bg-secondary/40 pl-6 pr-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-finance/60 focus:ring-2 focus:ring-finance/20"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
            }}
            placeholder="¿Qué compraste?"
            aria-label="Nota"
            className="h-11 flex-1 rounded-xl border border-input bg-secondary/40 px-3.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-finance/60 focus:ring-2 focus:ring-finance/20"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!amount || !activeHobbyId}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-finance px-4 text-sm font-medium text-accent-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Registrar
          </button>
        </div>
      </div>
    </section>
  )
}
