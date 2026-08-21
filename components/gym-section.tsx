"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  Award,
  CalendarDays,
  Dumbbell,
  Flame,
  LayoutGrid,
  Play,
  Ruler,
  Scale,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { computePersonalRecords, fetchWorkouts, workoutVolume, EXERCISE_LIBRARY, type MuscleGroup } from "@/lib/gym"
import { fetchWeightEntries, fetchNutritionProfile } from "@/lib/nutrition"
import { toDisplayWeight, formatWeight } from "@/lib/units"
import { useGame } from "@/lib/game-context"
import { parseISODate, dateToISO, formatDate } from "@/lib/format"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GymRoutines } from "@/components/gym-routines"
import { WorkoutLogger } from "@/components/workout-logger"
import { GymHistory } from "@/components/gym-history"
import { GymProgress } from "@/components/gym-progress"
import { BodyMeasurements } from "@/components/body-measurements"

type PageTab = "resumen" | "rutinas" | "registrar" | "historial" | "progreso" | "medidas"

const MUSCLE_GROUP_BY_NAME = new Map(EXERCISE_LIBRARY.map((ex) => [ex.name, ex.muscleGroup]))

function getWeekStart(d: Date): Date {
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday)
}

function computeWeekStreak(dates: string[]): number {
  const weeks = new Set(dates.map((iso) => dateToISO(getWeekStart(parseISODate(iso)))))
  let streak = 0
  let cursor = getWeekStart(new Date())
  while (weeks.has(dateToISO(cursor))) {
    streak++
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7)
  }
  return streak
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: typeof Dumbbell
  label: string
  value: string
  hint?: string
  tone?: "indigo" | "emerald" | "blue" | "amber"
}) {
  const toneMap: Record<string, string> = {
    indigo: "bg-gym/12 text-gym",
    emerald: "bg-gym/12 text-gym",
    blue: "bg-gym/12 text-gym",
    amber: "bg-[oklch(0.8_0.16_70_/_0.14)] text-[oklch(0.7_0.16_70)]",
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

export function GymSection() {
  const { user } = useGame()
  const uid = user!.uid
  const [pageTab, setPageTab] = useState<PageTab>("resumen")

  const { data: workoutsData } = useSWR(["workouts", uid], () => fetchWorkouts(uid))
  const { data: weightData } = useSWR(["weight", uid], () => fetchWeightEntries(uid))
  const { data: profile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const unit = profile?.weightUnit ?? "kg"

  const workouts = workoutsData ?? []

  const thisWeekStart = useMemo(() => getWeekStart(new Date()), [])
  const thisWeekWorkouts = useMemo(
    () => workouts.filter((w) => parseISODate(w.date) >= thisWeekStart),
    [workouts, thisWeekStart],
  )
  const streak = useMemo(() => computeWeekStreak(workouts.map((w) => w.date)), [workouts])

  const monthStart = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }, [])
  const monthWorkouts = useMemo(() => workouts.filter((w) => parseISODate(w.date) >= monthStart), [workouts, monthStart])
  const monthVolume = useMemo(() => Math.round(monthWorkouts.reduce((s, w) => s + workoutVolume(w), 0)), [monthWorkouts])

  const topMuscleGroup = useMemo(() => {
    const counts = new Map<MuscleGroup, number>()
    for (const w of monthWorkouts) {
      for (const ex of w.exercises) {
        const group = MUSCLE_GROUP_BY_NAME.get(ex.exerciseName)
        if (!group) continue
        counts.set(group, (counts.get(group) ?? 0) + 1)
      }
    }
    let best: MuscleGroup | null = null
    let bestCount = 0
    counts.forEach((count, group) => {
      if (count > bestCount) {
        best = group
        bestCount = count
      }
    })
    return best
  }, [monthWorkouts])

  const prs = useMemo(() => computePersonalRecords(workouts).slice(0, 3), [workouts])
  const latestWeight = useMemo(() => {
    const sorted = [...(weightData ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0] ?? null
  }, [weightData])

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as PageTab)}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="resumen" className="gap-1.5">
            <LayoutGrid className="size-4" aria-hidden="true" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="rutinas" className="gap-1.5">
            <Dumbbell className="size-4" aria-hidden="true" />
            Rutinas
          </TabsTrigger>
          <TabsTrigger value="registrar" className="gap-1.5">
            <Play className="size-4" aria-hidden="true" />
            Registrar
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="progreso" className="gap-1.5">
            <TrendingUp className="size-4" aria-hidden="true" />
            Progreso
          </TabsTrigger>
          <TabsTrigger value="medidas" className="gap-1.5">
            <Ruler className="size-4" aria-hidden="true" />
            Medidas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === "resumen" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={Dumbbell}
              label="Esta semana"
              value={String(thisWeekWorkouts.length)}
              hint="entrenamientos"
              tone="indigo"
            />
            <StatTile
              icon={Flame}
              label="Racha"
              value={`${streak} sem.`}
              hint={streak > 0 ? "semanas seguidas" : "entrena esta semana"}
              tone={streak > 0 ? "emerald" : "amber"}
            />
            <StatTile
              icon={TrendingUp}
              label="Volumen del mes"
              value={`${Math.round(toDisplayWeight(monthVolume, unit)).toLocaleString()} ${unit}`}
              hint={topMuscleGroup ? `Más entrenado: ${topMuscleGroup}` : "sin datos"}
              tone="blue"
            />
            <StatTile
              icon={Scale}
              label="Peso actual"
              value={latestWeight ? formatWeight(latestWeight.weightKg, unit) : "—"}
              hint={latestWeight ? formatDate(latestWeight.date) : "registra tu peso"}
              tone="amber"
            />
          </div>

          <section className="glass rounded-3xl p-5 sm:p-6">
            <header className="mb-4 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-[oklch(0.8_0.16_70_/_0.14)]">
                <Award className="size-5 text-[oklch(0.7_0.16_70)]" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Récords recientes</h2>
                <p className="text-sm text-muted-foreground">Tus mejores marcas por ejercicio.</p>
              </div>
            </header>
            {prs.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-3">
                {prs.map((pr) => (
                  <li key={pr.exerciseName} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-1 flex items-center gap-1.5 text-gym">
                      <Trophy className="size-4" aria-hidden="true" />
                      <span className="text-xs font-medium">PR</span>
                    </div>
                    <p className="truncate font-medium">{pr.exerciseName}</p>
                    <p className="text-sm text-muted-foreground">
                      {toDisplayWeight(pr.maxWeightKg, unit)}{unit} × {pr.repsAtMaxWeight}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Registra tu primer entrenamiento para ver récords aquí.
              </p>
            )}
          </section>
        </>
      )}

      {pageTab === "rutinas" && <GymRoutines uid={uid} />}
      {pageTab === "registrar" && <WorkoutLogger uid={uid} />}
      {pageTab === "historial" && <GymHistory uid={uid} />}
      {pageTab === "progreso" && <GymProgress uid={uid} />}
      {pageTab === "medidas" && <BodyMeasurements uid={uid} />}
    </div>
  )
}
