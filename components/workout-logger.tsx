"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import {
  Check,
  ChevronDown,
  Dumbbell,
  Play,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  createWorkout,
  fetchRoutines,
  fetchWorkouts,
  suggestNextLoad,
  computeExerciseRank,
  findExerciseByName,
  EXERCISE_INSTRUCTIONS_ES,
  RANK_COLORS,
  type Routine,
  type SetLog,
  type WorkoutExercise,
} from "@/lib/gym"
import { fetchNutritionProfile } from "@/lib/nutrition"
import { toDisplayWeight, fromDisplayWeight, formatWeight, weightStep } from "@/lib/units"
import { useGame } from "@/lib/game-context"
import { todayISO } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExerciseImage } from "@/components/exercise-image"
import { ExercisePicker } from "@/components/exercise-picker"

const REST_PRESETS = [60, 90, 120]

function emptySet(reps = 10, weightKg = 0): SetLog {
  return { reps, weightKg, completed: false }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, "0")}`
}

export function WorkoutLogger({ uid }: { uid: string }) {
  const { data: routines } = useSWR(["routines", uid], () => fetchRoutines(uid))
  const { data: workouts, mutate: mutateWorkouts } = useSWR(["workouts", uid], () => fetchWorkouts(uid))
  const { data: profile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const unit = profile?.weightUnit ?? "kg"
  const { awardXp } = useGame()

  const [active, setActive] = useState<{
    name: string
    date: string
    routineId: string | null
    exercises: WorkoutExercise[]
    notes: string
    startedAt: number
  } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [restSeconds, setRestSeconds] = useState<number | null>(null)
  const [newExerciseName, setNewExerciseName] = useState("")
  const [saving, setSaving] = useState(false)
  const [techniqueOpen, setTechniqueOpen] = useState<number | null>(null)
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setElapsed(Date.now() - active.startedAt), 1000)
    return () => clearInterval(id)
  }, [active])

  useEffect(() => {
    if (restSeconds === null) return
    if (restSeconds <= 0) {
      toast.success("Descanso terminado")
      setRestSeconds(null)
      return
    }
    restIntervalRef.current = setInterval(() => {
      setRestSeconds((s) => (s !== null ? s - 1 : null))
    }, 1000)
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current)
    }
  }, [restSeconds])

  function startFromRoutine(routine: Routine) {
    setActive({
      name: routine.name,
      date: todayISO(),
      routineId: routine.id,
      exercises: routine.exercises.map((ex) => {
        const suggestion = suggestNextLoad(workouts ?? [], ex.exerciseName)
        const reps = suggestion?.reps ?? ex.targetReps
        const weight = suggestion?.weightKg ?? 0
        return {
          exerciseName: ex.exerciseName,
          sets: Array.from({ length: ex.targetSets }).map(() => emptySet(reps, weight)),
        }
      }),
      notes: "",
      startedAt: Date.now(),
    })
  }

  function startFreestyle() {
    setActive({
      name: "Entrenamiento libre",
      date: todayISO(),
      routineId: null,
      exercises: [],
      notes: "",
      startedAt: Date.now(),
    })
  }

  function cancelWorkout() {
    setActive(null)
    setRestSeconds(null)
  }

  function addExercise(nameOverride?: string) {
    const name = (nameOverride ?? newExerciseName).trim()
    if (!name || !active) return
    const suggestion = suggestNextLoad(workouts ?? [], name)
    setActive({
      ...active,
      exercises: [
        ...active.exercises,
        { exerciseName: name, sets: [emptySet(suggestion?.reps ?? 10, suggestion?.weightKg ?? 0)] },
      ],
    })
    setNewExerciseName("")
  }

  function removeExercise(index: number) {
    if (!active) return
    setActive({ ...active, exercises: active.exercises.filter((_, i) => i !== index) })
  }

  function addSet(exIndex: number) {
    if (!active) return
    const ex = active.exercises[exIndex]
    const last = ex.sets[ex.sets.length - 1]
    const nextSets = [...ex.sets, emptySet(last?.reps ?? 10, last?.weightKg ?? 0)]
    setActive({
      ...active,
      exercises: active.exercises.map((e, i) => (i === exIndex ? { ...e, sets: nextSets } : e)),
    })
  }

  function updateSet(exIndex: number, setIndex: number, patch: Partial<SetLog>) {
    if (!active) return
    setActive({
      ...active,
      exercises: active.exercises.map((e, i) =>
        i === exIndex ? { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) } : e,
      ),
    })
  }

  function removeSet(exIndex: number, setIndex: number) {
    if (!active) return
    setActive({
      ...active,
      exercises: active.exercises.map((e, i) => (i === exIndex ? { ...e, sets: e.sets.filter((_, j) => j !== setIndex) } : e)),
    })
  }

  async function finishWorkout() {
    if (!active) return
    const totalSets = active.exercises.reduce((s, ex) => s + ex.sets.filter((set) => set.completed).length, 0)
    if (totalSets === 0) {
      toast.error("Marca al menos una serie como completada antes de guardar.")
      return
    }
    setSaving(true)
    try {
      await createWorkout(uid, {
        date: active.date,
        name: active.name.trim() || "Entrenamiento",
        routineId: active.routineId,
        exercises: active.exercises.filter((ex) => ex.sets.some((s) => s.completed)),
        durationMin: Math.max(1, Math.round(elapsed / 60000)),
        notes: active.notes,
      })
      await mutateWorkouts()
      awardXp(20, "Entrenamiento completado")
      toast.success("¡Entrenamiento guardado!")
      setActive(null)
      setRestSeconds(null)
    } catch {
      toast.error("No se pudo guardar el entrenamiento")
    } finally {
      setSaving(false)
    }
  }

  if (!active) {
    return (
      <section className="glass rounded-3xl p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
            <Play className="size-5 text-gym" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Empezar entrenamiento</h2>
            <p className="text-sm text-muted-foreground">Elige una rutina o entrena libre.</p>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {(routines ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => startFromRoutine(r)}
              className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-gym/50 hover:bg-secondary/40"
            >
              <p className="font-medium text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.exercises.length} ejercicios</p>
            </button>
          ))}
          <button
            type="button"
            onClick={startFreestyle}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-4 text-center text-muted-foreground transition-colors hover:border-gym/50 hover:text-foreground"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="text-sm font-medium">Entrenamiento libre</span>
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="glass sticky top-2 z-10 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gym/12">
              <Dumbbell className="size-5 text-gym" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <input
                value={active.name}
                onChange={(e) => setActive({ ...active, name: e.target.value })}
                className="w-full truncate bg-transparent font-display text-lg font-semibold tracking-tight outline-none"
                aria-label="Nombre del entrenamiento"
              />
              <p className="font-mono text-sm tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cancelWorkout} className="gap-1.5">
              <X className="size-3.5" />
              Cancelar
            </Button>
            <Button size="sm" onClick={finishWorkout} disabled={saving} className="gap-1.5">
              <Check className="size-3.5" />
              {saving ? "Guardando..." : "Finalizar"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="size-3.5" aria-hidden="true" />
            Descanso:
          </span>
          {restSeconds !== null ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-gym/12 px-3 py-1 text-sm font-medium font-mono tabular-nums text-gym">
              {restSeconds}s
              <button type="button" onClick={() => setRestSeconds(null)} aria-label="Cancelar descanso">
                <X className="size-3.5" />
              </button>
            </span>
          ) : (
            REST_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRestSeconds(s)}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium hover:bg-secondary/70"
              >
                {s}s
              </button>
            ))
          )}
        </div>
      </section>

      {active.exercises.map((ex, exIndex) => {
        const suggestion = suggestNextLoad(workouts ?? [], ex.exerciseName)
        const rank = computeExerciseRank(workouts ?? [], ex.exerciseName)
        const libraryId = findExerciseByName(ex.exerciseName)?.id
        const technique = libraryId ? EXERCISE_INSTRUCTIONS_ES[libraryId] : undefined
        const techniqueShown = techniqueOpen === exIndex
        return (
        <section key={exIndex} className="glass rounded-3xl p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ExerciseImage exerciseName={ex.exerciseName} className="size-12 rounded-lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-display text-base font-semibold tracking-tight">{ex.exerciseName}</p>
                  {rank && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: `color-mix(in oklch, ${RANK_COLORS[rank.rank]} 20%, transparent)`, color: RANK_COLORS[rank.rank] }}
                      title={`${rank.improvementPct}% de mejora desde tu primer registro`}
                    >
                      {rank.rank}
                    </span>
                  )}
                </div>
                {suggestion && (
                  <p className="text-xs text-muted-foreground">
                    Sugerido: {formatWeight(suggestion.weightKg, unit)} × {suggestion.reps} (última vez:{" "}
                    {formatWeight(suggestion.basedOn.weightKg, unit)} × {suggestion.basedOn.reps})
                  </p>
                )}
                {technique && (
                  <button
                    type="button"
                    onClick={() => setTechniqueOpen(techniqueShown ? null : exIndex)}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-gym hover:underline"
                  >
                    <ChevronDown className={`size-3 transition-transform ${techniqueShown ? "rotate-180" : ""}`} aria-hidden="true" />
                    Ver técnica
                  </button>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeExercise(exIndex)}
              aria-label="Quitar ejercicio"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {technique && techniqueShown && (
            <ol className="mb-3 flex list-decimal flex-col gap-1 rounded-xl bg-secondary/30 px-4 py-3 pl-8 text-sm text-muted-foreground">
              {technique.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_2rem] items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span>#</span>
              <span>Reps</span>
              <span>Peso ({unit})</span>
              <span className="text-center">✓</span>
              <span />
            </div>
            {ex.sets.map((set, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[2rem_1fr_1fr_2.5rem_2rem] items-center gap-2">
                <span className="text-sm text-muted-foreground">{setIndex + 1}</span>
                <input
                  type="number"
                  min="0"
                  value={set.reps}
                  onChange={(e) => updateSet(exIndex, setIndex, { reps: Number.parseInt(e.target.value, 10) || 0 })}
                  aria-label={`Repeticiones serie ${setIndex + 1}`}
                  className="h-9 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm font-mono tabular-nums outline-none focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
                />
                <input
                  type="number"
                  min="0"
                  step={weightStep(unit)}
                  value={toDisplayWeight(set.weightKg, unit)}
                  onChange={(e) =>
                    updateSet(exIndex, setIndex, { weightKg: fromDisplayWeight(Number.parseFloat(e.target.value) || 0, unit) })
                  }
                  aria-label={`Peso serie ${setIndex + 1}`}
                  className="h-9 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm font-mono tabular-nums outline-none focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
                />
                <button
                  type="button"
                  onClick={() => updateSet(exIndex, setIndex, { completed: !set.completed })}
                  aria-label={set.completed ? "Marcar como no completada" : "Marcar como completada"}
                  className={`grid size-9 place-items-center rounded-lg border transition-colors ${
                    set.completed
                      ? "border-gym/50 bg-gym/15 text-gym"
                      : "border-border bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <Check className="size-4" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSet(exIndex, setIndex)}
                  aria-label="Quitar serie"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => addSet(exIndex)}>
            <Plus className="size-3.5" />
            Serie
          </Button>
        </section>
        )
      })}

      <section className="glass rounded-3xl p-4 sm:p-5">
        <Label className="mb-2 block text-xs text-muted-foreground">Agregar ejercicio</Label>
        <ExercisePicker
          value={newExerciseName}
          onValueChange={setNewExerciseName}
          onSelect={(name) => addExercise(name)}
          placeholder="Buscar ejercicio para agregar..."
        />
      </section>

      <section className="glass rounded-3xl p-4 sm:p-5">
        <Label htmlFor="workout-notes">Notas</Label>
        <textarea
          id="workout-notes"
          value={active.notes}
          onChange={(e) => setActive({ ...active, notes: e.target.value })}
          placeholder="¿Cómo te sentiste? Opcional."
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-input bg-secondary/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
        />
        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor="workout-date" className="text-xs text-muted-foreground">
            Fecha
          </Label>
          <Input
            id="workout-date"
            type="date"
            value={active.date}
            onChange={(e) => setActive({ ...active, date: e.target.value })}
            className="h-9 w-40"
          />
        </div>
      </section>
    </div>
  )
}
