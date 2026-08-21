"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Loader2, Plus, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  deleteWeightEntry,
  fetchNutritionProfile,
  fetchWeightEntries,
  logWeight,
  calculateBMI,
  bmiCategory,
  type WeightInput,
} from "@/lib/nutrition"
import { formatDate } from "@/lib/format"
import { toDisplayWeight, formatWeight } from "@/lib/units"
import { Button } from "@/components/ui/button"
import { WeightDialog } from "@/components/weight-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

export function NutritionWeight({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["weight", uid], () => fetchWeightEntries(uid))
  const { data: profile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; date: string } | null>(null)

  const entries = data ?? []
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries])
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const delta = latest && previous ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : null

  const bmi = latest && profile?.heightCm ? calculateBMI(latest.weightKg, profile.heightCm) : 0
  const unit = profile?.weightUnit ?? "kg"

  const chartData = sorted
    .slice(-30)
    .map((e) => ({ label: formatDate(e.date).slice(0, 6), weight: toDisplayWeight(e.weightKg, unit) }))
  const chartConfig: ChartConfig = { weight: { label: `Peso (${unit})`, color: "var(--chart-2)" } }

  async function handleSubmit(input: WeightInput) {
    await logWeight(uid, input)
    toast.success("Peso registrado")
    await mutate()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    await mutate(
      async () => {
        await deleteWeightEntry(uid, target.id)
        return entries.filter((x) => x.id !== target.id)
      },
      { optimisticData: entries.filter((x) => x.id !== target.id), rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success("Registro eliminado"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-nutrition/12 text-nutrition">
              <Scale className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Peso actual</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums">
            {latest ? formatWeight(latest.weightKg, unit) : "—"}
          </p>
          {delta !== null && (
            <span
              className={`mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? "text-[oklch(0.6_0.18_60)]" : delta < 0 ? "text-nutrition" : "text-muted-foreground"}`}
            >
              {delta > 0 ? <TrendingUp className="size-3" /> : delta < 0 ? <TrendingDown className="size-3" /> : null}
              {delta > 0 ? "+" : ""}
              {toDisplayWeight(delta, unit)} {unit} vs. anterior
            </span>
          )}
        </div>
        <div className="glass rounded-2xl p-4">
          <span className="text-xs font-medium text-muted-foreground">IMC</span>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums">
            {bmi > 0 ? bmi : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {profile?.heightCm ? bmiCategory(bmi) : "Configura tu estatura en Objetivos"}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <span className="text-xs font-medium text-muted-foreground">Registros</span>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums">{entries.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">mediciones totales</p>
        </div>
      </div>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Evolución del peso</h2>
            <p className="text-sm text-muted-foreground">Últimas {Math.min(30, sorted.length)} mediciones</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Registrar</span>
          </Button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : chartData.length > 1 ? (
          <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
            <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-weight)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-weight)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                fontSize={12}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} fill="url(#fillWeight)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Registra al menos dos mediciones para ver la tendencia.
          </p>
        )}
      </section>

      {entries.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <h3 className="mb-3 font-display text-base font-semibold tracking-tight">Historial</h3>
          <ul className="flex flex-col divide-y divide-border">
            {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
              <li key={e.id} className="group flex items-center gap-3 py-2.5">
                <span className="flex-1 text-sm text-muted-foreground">{formatDate(e.date)}</span>
                <span className="font-mono font-semibold tabular-nums">{formatWeight(e.weightKg, unit)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => setDeleteTarget({ id: e.id, date: e.date })}
                  aria-label="Eliminar registro"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeightDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} unit={unit} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar registro de peso?"
        description={deleteTarget ? `Esto elimina la medición del ${formatDate(deleteTarget.date)}.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
