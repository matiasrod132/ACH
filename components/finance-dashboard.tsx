"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  PiggyBank,
  Pencil,
  Check,
  Plus,
  LogOut,
  Loader2,
  Scale,
  LayoutGrid,
  ArrowLeftRight,
  Target,
  AlertTriangle,
  BarChart3,
  CalendarClock,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { useGame } from "@/lib/game-context"
import { usePageTab } from "@/lib/use-page-tab"
import {
  createMovement,
  deleteMovement,
  fetchBudget,
  saveBudget,
  updateMovement,
  useMovements,
  type Movement,
  type MovementInput,
} from "@/lib/movements"
import { formatCurrency } from "@/lib/format"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MovementList } from "@/components/movement-list"
import { MovementDialog } from "@/components/movement-dialog"
import { FinanceGoals } from "@/components/finance-goals"
import { FinanceReports } from "@/components/finance-reports"
import { FinancePayments } from "@/components/finance-payments"
import { ConfirmDialog } from "@/components/confirm-dialog"

const CHART_VARS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

type Filter = "all" | "income" | "expense"
type PageTab = "resumen" | "movimientos" | "metas" | "reportes" | "pagos"
const PAGE_TABS = ["resumen", "movimientos", "metas", "reportes", "pagos"] as const

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint?: string
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
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function FinanceDashboard() {
  const { user, signOut } = useGame()
  const uid = user!.uid

  const { data, isLoading, mutate } = useMovements(uid)
  const { data: budget = 0, mutate: mutateBudget } = useSWR(["budget", uid], () => fetchBudget(uid))

  const [pageTab, setPageTab] = usePageTab<PageTab>(PAGE_TABS, "resumen")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Movement | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState("0")
  const [deleteTarget, setDeleteTarget] = useState<Movement | null>(null)

  const movements = data ?? []

  const now = new Date()
  const monthStartKey = monthKey(now)
  const dayOfMonth = now.getDate()

  const monthMovements = movements.filter((m) => monthKey(new Date(m.date)) === monthStartKey)
  const monthIncome = monthMovements.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0)
  const total = monthMovements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0)
  const remaining = budget - total
  const avgPerDay = dayOfMonth > 0 ? total / dayOfMonth : 0
  const rawBudgetPct = budget > 0 ? Math.round((total / budget) * 100) : 0
  const budgetPct = Math.min(100, rawBudgetPct)
  const budgetAlertTier: 0 | 80 | 100 = rawBudgetPct >= 100 ? 100 : rawBudgetPct >= 80 ? 80 : 0

  const alertedTierRef = useRef<0 | 80 | 100>(0)
  useEffect(() => {
    if (!budget || isLoading) return
    if (budgetAlertTier > alertedTierRef.current) {
      if (budgetAlertTier === 100) {
        toast.error(`Superaste tu presupuesto mensual por ${formatCurrency(total - budget)}`)
      } else if (budgetAlertTier === 80) {
        toast.error(`Vas en el ${rawBudgetPct}% de tu presupuesto mensual — quedan ${formatCurrency(remaining)}`)
      }
    }
    alertedTierRef.current = budgetAlertTier
  }, [budgetAlertTier, budget, isLoading, rawBudgetPct, remaining, total])

  const perCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of monthMovements) {
      if (m.type !== "expense") continue
      map.set(m.category, (map.get(m.category) ?? 0) + m.amount)
    }
    return Array.from(map.entries())
      .map(([category, amount], i) => ({ category, amount, fill: CHART_VARS[i % CHART_VARS.length] }))
      .sort((a, b) => b.amount - a.amount)
      .map((r, i) => ({ ...r, fill: CHART_VARS[i % CHART_VARS.length] }))
  }, [monthMovements])

  const biggest = perCategory[0]

  const trendData = useMemo(() => {
    const buckets: { label: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      const bucketMovements = movements.filter((m) => monthKey(new Date(m.date)) === key)
      const expense = bucketMovements
        .filter((m) => m.type === "expense")
        .reduce((s, m) => s + m.amount, 0)
      const income = bucketMovements
        .filter((m) => m.type === "income")
        .reduce((s, m) => s + m.amount, 0)
      buckets.push({
        label: d.toLocaleDateString("es", { month: "short" }),
        income: Math.round(income),
        expense: Math.round(expense),
      })
    }
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements])

  const trendConfig: ChartConfig = {
    income: { label: "Ingresos", color: "var(--chart-2)" },
    expense: { label: "Gastos", color: "var(--chart-1)" },
  }
  const pieConfig: ChartConfig = Object.fromEntries(
    perCategory.map((r, i) => [r.category, { label: r.category, color: CHART_VARS[i % CHART_VARS.length] }]),
  )

  const filtered = useMemo(
    () => (filter === "all" ? movements : movements.filter((m) => m.type === filter)),
    [movements, filter],
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(m: Movement) {
    setEditing(m)
    setDialogOpen(true)
  }

  async function handleSubmit(input: MovementInput) {
    if (editing) {
      await updateMovement(uid, editing.id, input)
      toast.success("Movimiento actualizado")
    } else {
      await createMovement(uid, input)
      toast.success("Movimiento añadido")
    }
    await mutate()
  }

  function handleDelete(m: Movement) {
    if (m.automatic) {
      toast.error("Los movimientos automáticos no se pueden eliminar")
      return
    }
    setDeleteTarget(m)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const m = deleteTarget
    await mutate(
      async () => {
        await deleteMovement(uid, m.id)
        return movements.filter((x) => x.id !== m.id)
      },
      {
        optimisticData: movements.filter((x) => x.id !== m.id),
        rollbackOnError: true,
        revalidate: false,
      },
    )
      .then(() => toast.success("Movimiento eliminado"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  async function commitBudget() {
    const v = Number.parseFloat(budgetDraft)
    setEditingBudget(false)
    if (!Number.isFinite(v) || v < 0) return
    await mutateBudget(
      async () => {
        await saveBudget(uid, v)
        return Math.round(v)
      },
      { optimisticData: Math.round(v), rollbackOnError: true, revalidate: false },
    ).catch(() => toast.error("No se pudo guardar el presupuesto"))
  }

  return (
    <div className="relative min-h-svh">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 0%, oklch(0.62 0.21 275 / 0.16), transparent 70%), radial-gradient(50% 45% at 95% 10%, oklch(0.7 0.16 165 / 0.12), transparent 70%)",
        }}
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Finanzas</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {pageTab === "movimientos" && (
              <Button onClick={openCreate} size="sm" className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Añadir</span>
              </Button>
            )}
          </div>
        </header>

        <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as PageTab)}>
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="resumen" className="gap-1.5">
              <LayoutGrid className="size-4" aria-hidden="true" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="movimientos" className="gap-1.5">
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Movimientos
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-1.5">
              <Target className="size-4" aria-hidden="true" />
              Metas
            </TabsTrigger>
            <TabsTrigger value="reportes" className="gap-1.5">
              <BarChart3 className="size-4" aria-hidden="true" />
              Reportes
            </TabsTrigger>
            <TabsTrigger value="pagos" className="gap-1.5">
              <CalendarClock className="size-4" aria-hidden="true" />
              Pagos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {pageTab === "resumen" && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Wallet}
                label="Gastado este mes"
                value={formatCurrency(total)}
                hint={`${monthMovements.filter((m) => m.type === "expense").length} gastos`}
                tone="indigo"
              />
              <StatCard
                icon={PiggyBank}
                label="Presupuesto restante"
                value={formatCurrency(remaining)}
                hint={remaining >= 0 ? "en camino" : "sobre presupuesto"}
                tone={remaining >= 0 ? "emerald" : "amber"}
              />
              <StatCard
                icon={CalendarDays}
                label="Promedio / día"
                value={formatCurrency(avgPerDay)}
                hint={`día ${dayOfMonth} del mes`}
                tone="blue"
              />
              <StatCard
                icon={monthIncome >= total ? TrendingUp : TrendingDown}
                label="Ingresos este mes"
                value={formatCurrency(monthIncome)}
                hint={biggest ? `Top gasto: ${biggest.category}` : "sin gastos aún"}
                tone="amber"
              />
            </div>

            {/* Budget progress */}
            <section className="glass rounded-3xl p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Presupuesto mensual</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(total)} de {formatCurrency(budget)} usado
                  </p>
                </div>
                {editingBudget ? (
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={budgetDraft}
                        onChange={(e) => setBudgetDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) commitBudget()
                        }}
                        aria-label="Presupuesto mensual"
                        className="h-10 w-full rounded-xl border border-input bg-secondary/40 pl-6 pr-2 text-sm outline-none focus:border-finance/60 focus:ring-2 focus:ring-finance/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={commitBudget}
                      className="grid size-10 place-items-center rounded-xl bg-finance text-primary-foreground hover:brightness-110"
                      aria-label="Guardar presupuesto"
                    >
                      <Check className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetDraft(String(budget))
                      setEditingBudget(true)
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Editar
                  </button>
                )}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${
                    budgetPct < 80
                      ? "bg-finance"
                      : budgetPct < 100
                        ? "bg-[oklch(0.8_0.16_70)]"
                        : "bg-destructive"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{budgetPct}% del presupuesto usado</p>

              {budgetAlertTier > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  {budgetAlertTier === 100
                    ? `Superaste tu presupuesto mensual por ${formatCurrency(total - budget)}.`
                    : `Estás cerca de tu presupuesto mensual (${rawBudgetPct}%) — quedan ${formatCurrency(remaining)}.`}
                </div>
              )}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Income vs expense trend */}
              <section className="glass rounded-3xl p-5 sm:p-6">
                <header className="mb-4 flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
                    <TrendingUp className="size-5 text-finance" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">Ingresos vs. gastos</h2>
                    <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
                  </div>
                </header>
                <ChartContainer config={trendConfig} className="aspect-[16/10] w-full">
                  <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} width={40} fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="var(--color-income)"
                      strokeWidth={2}
                      fill="url(#fillIncome)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stroke="var(--color-expense)"
                      strokeWidth={2}
                      fill="url(#fillExpense)"
                    />
                  </AreaChart>
                </ChartContainer>
              </section>

              {/* Category breakdown */}
              <section className="glass rounded-3xl p-5 sm:p-6">
                <header className="mb-4 flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
                    <Wallet className="size-5 text-finance" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">Por categoría</h2>
                    <p className="text-sm text-muted-foreground">Gastos de este mes</p>
                  </div>
                </header>
                {perCategory.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ChartContainer config={pieConfig} className="aspect-square h-40">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="category" hideLabel />} />
                        <Pie data={perCategory} dataKey="amount" nameKey="category" innerRadius={42} strokeWidth={2}>
                          {perCategory.map((r) => (
                            <Cell key={r.category} fill={r.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="flex flex-1 flex-col gap-2">
                      {perCategory.slice(0, 5).map((r, i) => {
                        const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
                        return (
                          <li key={r.category} className="flex items-center gap-2 text-sm">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: CHART_VARS[i % CHART_VARS.length] }}
                            />
                            <span className="flex-1 truncate">{r.category}</span>
                            <span className="tabular-nums text-muted-foreground">{pct}%</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aún no hay gastos registrados este mes.
                  </p>
                )}
              </section>
            </div>
          </>
        )}

        {pageTab === "movimientos" && (
          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
                  <Scale className="size-5 text-finance" aria-hidden="true" />
                </span>
                <h2 className="font-display text-lg font-semibold tracking-tight">Movimientos</h2>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="income">Ingresos</TabsTrigger>
                  <TabsTrigger value="expense">Gastos</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Cargando movimientos...</span>
              </div>
            ) : (
              <MovementList movements={filtered} onEdit={openEdit} onDelete={handleDelete} />
            )}
          </section>
        )}

        {pageTab === "metas" && <FinanceGoals uid={uid} />}

        {pageTab === "reportes" && <FinanceReports uid={uid} />}

        {pageTab === "pagos" && <FinancePayments uid={uid} />}

        <MovementDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSubmit={handleSubmit}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Eliminar movimiento"
          description={
            deleteTarget
              ? `Se eliminará "${deleteTarget.description || deleteTarget.category}" por ${formatCurrency(deleteTarget.amount)}. Esta acción no se puede deshacer.`
              : ""
          }
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  )
}
