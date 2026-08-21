"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Award, Loader2, Medal, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { computePersonalRecords, computeExerciseRank, fetchWorkouts, workoutVolume, RANK_COLORS } from "@/lib/gym"
import { fetchNutritionProfile } from "@/lib/nutrition"
import { toDisplayWeight, formatWeight } from "@/lib/units"
import { formatDate } from "@/lib/format"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function GymProgress({ uid }: { uid: string }) {
  const { data, isLoading } = useSWR(["workouts", uid], () => fetchWorkouts(uid))
  const { data: profile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const unit = profile?.weightUnit ?? "kg"
  const workouts = data ?? []

  const prs = useMemo(() => computePersonalRecords(workouts), [workouts])

  const exerciseNames = useMemo(() => {
    const names = new Set<string>()
    for (const w of workouts) for (const ex of w.exercises) names.add(ex.exerciseName)
    return Array.from(names).sort()
  }, [workouts])

  const ranks = useMemo(
    () =>
      exerciseNames
        .map((name) => ({ name, info: computeExerciseRank(workouts, name) }))
        .filter((r): r is { name: string; info: NonNullable<typeof r.info> } => r.info !== null)
        .sort((a, b) => b.info.improvementPct - a.info.improvementPct),
    [exerciseNames, workouts],
  )

  const [selectedExercise, setSelectedExercise] = useState<string>("")
  const effectiveExercise = selectedExercise || exerciseNames[0] || ""

  const strengthData = useMemo(() => {
    if (!effectiveExercise) return []
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
    return sorted
      .map((w) => {
        const ex = w.exercises.find((e) => e.exerciseName === effectiveExercise)
        if (!ex) return null
        const maxWeight = Math.max(0, ...ex.sets.filter((s) => s.completed).map((s) => s.weightKg))
        if (maxWeight <= 0) return null
        return { label: formatDate(w.date).slice(0, 6), weight: toDisplayWeight(maxWeight, unit) }
      })
      .filter((d): d is { label: string; weight: number } => d !== null)
  }, [workouts, effectiveExercise, unit])

  const exerciseHistory = useMemo(() => {
    if (!effectiveExercise) return []
    return [...workouts]
      .filter((w) => w.exercises.some((e) => e.exerciseName === effectiveExercise))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15)
      .map((w) => ({
        date: w.date,
        sets: w.exercises.find((e) => e.exerciseName === effectiveExercise)!.sets.filter((s) => s.completed),
      }))
      .filter((h) => h.sets.length > 0)
  }, [workouts, effectiveExercise])

  const volumeData = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-10)
    return sorted.map((w) => ({ label: formatDate(w.date).slice(0, 6), volume: Math.round(toDisplayWeight(workoutVolume(w), unit)) }))
  }, [workouts, unit])

  const volumeConfig: ChartConfig = { volume: { label: `Volumen (${unit})`, color: "var(--chart-1)" } }
  const strengthConfig: ChartConfig = { weight: { label: `Peso máx. (${unit})`, color: "var(--chart-2)" } }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    )
  }

  if (workouts.length === 0) {
    return (
      <section className="glass rounded-3xl p-5 sm:p-6">
        <p className="py-10 text-center text-sm text-muted-foreground">
          Registra entrenamientos para ver tu progreso aquí.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
            <TrendingUp className="size-5 text-gym" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Volumen por entrenamiento</h2>
            <p className="text-sm text-muted-foreground">Últimos {volumeData.length} entrenamientos ({unit} totales)</p>
          </div>
        </header>
        <ChartContainer config={volumeConfig} className="aspect-[16/9] w-full">
          <BarChart data={volumeData} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="volume" fill="var(--color-volume)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      {exerciseNames.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
                <TrendingUp className="size-5 text-gym" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold tracking-tight">Progreso por ejercicio</h2>
            </div>
            <Select value={effectiveExercise} onValueChange={(v) => setSelectedExercise(v ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Elige un ejercicio" />
              </SelectTrigger>
              <SelectContent>
                {exerciseNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </header>
          {strengthData.length > 1 ? (
            <ChartContainer config={strengthConfig} className="aspect-[16/9] w-full">
              <LineChart data={strengthData} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={36} fontSize={12} domain={["dataMin - 5", "dataMax + 5"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Registra este ejercicio en al menos dos entrenamientos para ver la tendencia.
            </p>
          )}
          {exerciseHistory.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Sesiones registradas</h3>
              <ul className="flex flex-col divide-y divide-border">
                {exerciseHistory.map((h) => (
                  <li key={h.date} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-20 shrink-0 text-muted-foreground">{formatDate(h.date)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {h.sets.map((s, i) => (
                        <span key={i} className="mr-2 font-mono tabular-nums">
                          {s.reps}×{toDisplayWeight(s.weightKg, unit)}
                          {i < h.sets.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {ranks.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <header className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
              <Medal className="size-5 text-gym" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Rangos por ejercicio</h2>
              <p className="text-sm text-muted-foreground">
                Basado en tu propio progreso — no son estándares de fuerza poblacionales, solo comparan tu marca
                actual contra tu primer registro.
              </p>
            </div>
          </header>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ranks.map(({ name, info }) => (
              <li key={name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold"
                  style={{ background: `color-mix(in oklch, ${RANK_COLORS[info.rank]} 20%, transparent)`, color: RANK_COLORS[info.rank] }}
                >
                  {info.rank.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {info.rank} · +{info.improvementPct}% · {info.sessionsLogged} sesiones
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass rounded-3xl p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[oklch(0.8_0.16_70_/_0.14)]">
            <Award className="size-5 text-[oklch(0.7_0.16_70)]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Récords personales</h2>
            <p className="text-sm text-muted-foreground">Mejor serie por ejercicio (1RM estimado)</p>
          </div>
        </header>
        <ul className="flex flex-col divide-y divide-border">
          {prs.map((pr) => (
            <li key={pr.exerciseName} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pr.exerciseName}</p>
                <p className="text-xs text-muted-foreground">
                  {toDisplayWeight(pr.maxWeightKg, unit)}{unit} × {pr.repsAtMaxWeight} · {formatDate(pr.date)}
                </p>
              </div>
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums font-mono text-gym">
                {formatWeight(pr.estimated1RM, unit)} 1RM
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
