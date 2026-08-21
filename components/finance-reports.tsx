"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  PiggyBank,
  Tag,
  Sparkles,
  Target,
  Loader2,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { fetchMovements, fetchGoals, fetchBudget, type Movement } from "@/lib/movements"
import { useGame } from "@/lib/game-context"
import { formatCurrency } from "@/lib/format"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

type Period = "week" | "month" | "year"

const PERIOD_LABEL: Record<Period, string> = { week: "esta semana", month: "este mes", year: "este año" }
const PREV_LABEL: Record<Period, string> = {
  week: "la semana pasada",
  month: "el mes pasado",
  year: "el año pasado",
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function getRange(period: Period, offset: number, now: Date) {
  if (period === "week") {
    const dayOfWeek = now.getDay()
    const diffToMonday = (dayOfWeek + 6) % 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday - offset * 7)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
    return { start, end }
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }
  const start = new Date(now.getFullYear() - offset, 0, 1)
  const end = new Date(now.getFullYear() - offset, 11, 31, 23, 59, 59, 999)
  return { start, end }
}

function sumInRange(movements: Movement[], type: "income" | "expense", start: Date, end: Date) {
  return movements
    .filter((m) => m.type === type)
    .filter((m) => {
      const d = parseLocalDate(m.date)
      return d >= start && d <= end
    })
    .reduce((s, m) => s + m.amount, 0)
}

/** null = no comparable (no había datos en el período anterior). */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return Math.round(((current - previous) / previous) * 100)
}

function DeltaBadge({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">sin datos previos</span>
  const up = pct > 0
  const flat = pct === 0
  const good = flat ? null : up === goodWhenUp
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const tone = flat ? "text-muted-foreground" : good ? "text-finance" : "text-destructive"
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-medium tabular-nums ${tone}`}>
      <Icon className="size-3" aria-hidden="true" />
      {up && !flat ? "+" : ""}
      {pct}%
    </span>
  )
}

function ReportStat({
  icon: Icon,
  label,
  value,
  pct,
  goodWhenUp,
  tone = "indigo",
}: {
  icon: typeof Wallet
  label: string
  value: string
  pct: number | null
  goodWhenUp: boolean
  tone?: "indigo" | "emerald" | "blue" | "amber"
}) {
  const toneMap: Record<string, string> = {
    indigo: "bg-finance/12 text-finance",
    emerald: "bg-finance/12 text-finance",
    blue: "bg-finance/12 text-finance",
    amber: "bg-[oklch(0.72_0.18_60_/_0.14)] text-[oklch(0.8_0.16_70)]",
  }
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight tabular-nums font-mono">{value}</p>
      <div className="mt-0.5">
        <DeltaBadge pct={pct} goodWhenUp={goodWhenUp} />
      </div>
    </div>
  )
}

export function FinanceReports({ uid }: { uid: string }) {
  const { data: movementsData, isLoading } = useSWR(["movements", uid], () => fetchMovements(uid))
  const { data: goalsData } = useSWR(["goals", uid], () => fetchGoals(uid))
  const { data: budget = 0 } = useSWR(["budget", uid], () => fetchBudget(uid))
  const { hobbies, expenses } = useGame()

  const [period, setPeriod] = useState<Period>("month")

  const movements = movementsData ?? []
  const goals = goalsData ?? []
  const now = new Date()
  const current = useMemo(() => getRange(period, 0, now), [period]) // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => getRange(period, 1, now), [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const gastoActual = sumInRange(movements, "expense", current.start, current.end)
  const gastoAnterior = sumInRange(movements, "expense", previous.start, previous.end)
  const ingresoActual = sumInRange(movements, "income", current.start, current.end)
  const ingresoAnterior = sumInRange(movements, "income", previous.start, previous.end)
  const gananciaActual = ingresoActual - gastoActual
  const gananciaAnterior = ingresoAnterior - gastoAnterior

  const currentMovements = useMemo(
    () =>
      movements.filter((m) => {
        const d = parseLocalDate(m.date)
        return d >= current.start && d <= current.end
      }),
    [movements, current],
  )

  const topCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of currentMovements) {
      if (m.type !== "expense") continue
      map.set(m.category, (map.get(m.category) ?? 0) + m.amount)
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return sorted[0] ?? null
  }, [currentMovements])

  const topHobby = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) {
      const d = new Date(e.date)
      if (d < current.start || d > current.end) continue
      map.set(e.hobbyId, (map.get(e.hobbyId) ?? 0) + e.amount)
    }
    const sorted = Array.from(map.entries())
      .map(([hobbyId, total]) => ({ hobby: hobbies.find((h) => h.id === hobbyId), total }))
      .filter((r): r is { hobby: NonNullable<typeof r.hobby>; total: number } => Boolean(r.hobby))
      .sort((a, b) => b.total - a.total)
    return sorted[0] ?? null
  }, [expenses, hobbies, current])

  const budgetEvolution = useMemo(() => {
    const buckets: { label: string; gasto: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      buckets.push({
        label: d.toLocaleDateString("es", { month: "short" }),
        gasto: Math.round(sumInRange(movements, "expense", monthStart, monthEnd)),
      })
    }
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements])

  const evolutionConfig: ChartConfig = {
    gasto: { label: "Gasto", color: "var(--chart-1)" },
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
            <BarChart3 className="size-5 text-finance" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Reportes y estadísticas</h2>
            <p className="text-sm text-muted-foreground">
              {PERIOD_LABEL[period]} vs. {PREV_LABEL[period]}
            </p>
          </div>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mes</TabsTrigger>
            <TabsTrigger value="year">Año</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Cargando reporte...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <ReportStat
              icon={Wallet}
              label="Gastos totales"
              value={formatCurrency(gastoActual)}
              pct={pctChange(gastoActual, gastoAnterior)}
              goodWhenUp={false}
              tone="indigo"
            />
            <ReportStat
              icon={TrendingUp}
              label="Ingresos totales"
              value={formatCurrency(ingresoActual)}
              pct={pctChange(ingresoActual, ingresoAnterior)}
              goodWhenUp={true}
              tone="blue"
            />
            <ReportStat
              icon={PiggyBank}
              label={gananciaActual >= 0 ? "Ganancia" : "Pérdida"}
              value={formatCurrency(gananciaActual)}
              pct={pctChange(gananciaActual, gananciaAnterior)}
              goodWhenUp={true}
              tone={gananciaActual >= 0 ? "emerald" : "amber"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-finance/12 text-finance">
                  <Tag className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Categoría con mayor gasto</span>
              </div>
              {topCategory ? (
                <>
                  <p className="mt-2 font-display text-lg font-semibold tracking-tight">{topCategory[0]}</p>
                  <p className="font-mono text-sm text-muted-foreground tabular-nums">{formatCurrency(topCategory[1])}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sin gastos {PERIOD_LABEL[period]}</p>
              )}
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-finance/12 text-finance">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Hobby más costoso</span>
              </div>
              {topHobby ? (
                <>
                  <p className="mt-2 font-display text-lg font-semibold tracking-tight">{topHobby.hobby.name}</p>
                  <p className="font-mono text-sm text-muted-foreground tabular-nums">{formatCurrency(topHobby.total)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sin gastos de hobbies {PERIOD_LABEL[period]}</p>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5">
            <h3 className="mb-1 font-display text-base font-semibold tracking-tight">Evolución del presupuesto</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Gasto mensual de los últimos 6 meses vs. tu presupuesto actual ({formatCurrency(budget)})
            </p>
            <ChartContainer config={evolutionConfig} className="aspect-[16/9] w-full">
              <BarChart data={budgetEvolution} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={40} fontSize={12} tickFormatter={(v) => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {budget > 0 && (
                  <ReferenceLine
                    y={budget}
                    stroke="var(--destructive)"
                    strokeDasharray="4 4"
                    label={{ value: "Presupuesto", position: "insideTopRight", fontSize: 11, fill: "var(--destructive)" }}
                  />
                )}
                <Bar dataKey="gasto" fill="var(--color-gasto)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-finance/12 text-finance">
                <Target className="size-4" aria-hidden="true" />
              </span>
              <h3 className="font-display text-base font-semibold tracking-tight">Progreso de las metas</h3>
            </div>
            {goals.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {goals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{g.name}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-finance"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no tienes metas creadas.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
