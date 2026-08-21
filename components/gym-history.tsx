"use client"

import { useState } from "react"
import useSWR from "swr"
import { CalendarDays, ChevronDown, Clock, Flame, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteWorkout, fetchWorkouts, workoutSetCount, workoutVolume, type Workout } from "@/lib/gym"
import { fetchNutritionProfile } from "@/lib/nutrition"
import { toDisplayWeight } from "@/lib/units"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"

export function GymHistory({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["workouts", uid], () => fetchWorkouts(uid))
  const { data: profile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const unit = profile?.weightUnit ?? "kg"
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null)

  const workouts = data ?? []

  async function confirmDelete() {
    if (!deleteTarget) return
    const w = deleteTarget
    await mutate(
      async () => {
        await deleteWorkout(uid, w.id)
        return workouts.filter((x) => x.id !== w.id)
      },
      { optimisticData: workouts.filter((x) => x.id !== w.id), rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success("Entrenamiento eliminado"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
          <CalendarDays className="size-5 text-gym" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Historial</h2>
          <p className="text-sm text-muted-foreground">{workouts.length} entrenamientos registrados</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      ) : workouts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {workouts.map((w) => {
            const isOpen = expanded === w.id
            const volume = workoutVolume(w)
            const sets = workoutSetCount(w)
            return (
              <li key={w.id} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : w.id)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{w.name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{formatDate(w.date)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden="true" />
                        {w.durationMin ?? "—"} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Flame className="size-3" aria-hidden="true" />
                        {Math.round(toDisplayWeight(volume, unit)).toLocaleString()} {unit} · {sets} series
                      </span>
                    </p>
                  </div>
                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border p-3">
                    <ul className="flex flex-col gap-2">
                      {w.exercises.map((ex, i) => (
                        <li key={i}>
                          <p className="text-sm font-medium">{ex.exerciseName}</p>
                          <p className="text-xs text-muted-foreground">
                            {ex.sets
                              .filter((s) => s.completed)
                              .map((s) => `${s.reps}×${toDisplayWeight(s.weightKg, unit)}${unit}`)
                              .join(" · ") || "Sin series completadas"}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {w.notes && <p className="mt-2 text-sm italic text-muted-foreground">&ldquo;{w.notes}&rdquo;</p>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(w)}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">Aún no has registrado entrenamientos.</p>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar entrenamiento?"
        description={`Esto elimina "${deleteTarget?.name}" del historial permanentemente.`}
        onConfirm={confirmDelete}
      />
    </section>
  )
}
