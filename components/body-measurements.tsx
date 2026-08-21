"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Loader2, Plus, Ruler, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  fetchMeasurements,
  logMeasurement,
  deleteMeasurementEntry,
  MEASUREMENT_FIELDS,
  type MeasurementEntry,
  type MeasurementInput,
} from "@/lib/measurements"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { MeasurementDialog } from "@/components/measurement-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BodyMeasurements({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["measurements", uid], () => fetchMeasurements(uid))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; date: string } | null>(null)

  const entries = data ?? []
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries])

  const fieldsWithData = useMemo(
    () => MEASUREMENT_FIELDS.filter((f) => entries.some((e) => e[f.key] !== null)),
    [entries],
  )
  const [selectedField, setSelectedField] = useState<string>("")
  const effectiveField = (fieldsWithData.find((f) => f.key === selectedField) ?? fieldsWithData[0])?.key

  const chartData = useMemo(() => {
    if (!effectiveField) return []
    return sorted
      .filter((e) => e[effectiveField] !== null)
      .slice(-30)
      .map((e) => ({ label: formatDate(e.date).slice(0, 6), value: e[effectiveField] as number }))
  }, [sorted, effectiveField])

  const chartConfig: ChartConfig = {
    value: { label: `${MEASUREMENT_FIELDS.find((f) => f.key === effectiveField)?.label ?? ""} (cm)`, color: "var(--chart-3)" },
  }

  async function handleSubmit(input: MeasurementInput) {
    await logMeasurement(uid, input)
    toast.success("Medidas registradas")
    await mutate()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    await mutate(
      async () => {
        await deleteMeasurementEntry(uid, target.id)
        return entries.filter((x) => x.id !== target.id)
      },
      { optimisticData: entries.filter((x) => x.id !== target.id), rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success("Registro eliminado"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  function latestAndDelta(key: keyof MeasurementEntry) {
    const withValue = sorted.filter((e) => e[key] !== null)
    const latest = withValue[withValue.length - 1]
    const previous = withValue[withValue.length - 2]
    const delta =
      latest && previous ? Math.round(((latest[key] as number) - (previous[key] as number)) * 10) / 10 : null
    return { latest: latest ? (latest[key] as number) : null, delta }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
            <Ruler className="size-5 text-gym" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Medidas corporales</h2>
            <p className="text-sm text-muted-foreground">{entries.length} registros</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Registrar</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEASUREMENT_FIELDS.map((f) => {
          const { latest, delta } = latestAndDelta(f.key)
          return (
            <div key={f.key} className="glass rounded-2xl p-4">
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
              <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums">
                {latest !== null ? `${latest} cm` : "—"}
              </p>
              {delta !== null && (
                <span
                  className={`mt-0.5 inline-flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums ${delta > 0 ? "text-gym" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {delta > 0 ? <TrendingUp className="size-3" /> : delta < 0 ? <TrendingDown className="size-3" /> : null}
                  {delta > 0 ? "+" : ""}
                  {delta} cm
                </span>
              )}
            </div>
          )
        })}
      </div>

      {fieldsWithData.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold tracking-tight">Evolución</h3>
            <Select value={effectiveField} onValueChange={(v) => setSelectedField(v ?? "")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Elige una medida" />
              </SelectTrigger>
              <SelectContent>
                {fieldsWithData.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </header>
          {chartData.length > 1 ? (
            <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillMeasure" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={36} fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill="url(#fillMeasure)" />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Registra esta medida al menos dos veces para ver la tendencia.
            </p>
          )}
        </section>
      )}

      {entries.length === 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <p className="py-6 text-center text-sm text-muted-foreground">
            Registra tus medidas (pecho, cintura, brazos...) para ver tu progreso corporal aquí.
          </p>
        </section>
      )}

      {entries.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <h3 className="mb-3 font-display text-base font-semibold tracking-tight">Historial</h3>
          <ul className="flex flex-col divide-y divide-border">
            {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
              <li key={e.id} className="group flex items-center gap-3 py-2.5">
                <span className="w-20 shrink-0 text-sm text-muted-foreground">{formatDate(e.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {MEASUREMENT_FIELDS.filter((f) => e[f.key] !== null)
                    .map((f) => `${f.label} ${e[f.key]}cm`)
                    .join(" · ") || "Sin datos"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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

      <MeasurementDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar registro de medidas?"
        description={deleteTarget ? `Esto elimina la medición del ${formatDate(deleteTarget.date)}.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
