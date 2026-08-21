"use client"

import { useState } from "react"
import useSWR from "swr"
import { Dumbbell, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createRoutine, deleteRoutine, fetchRoutines, updateRoutine, type Routine, type RoutineInput } from "@/lib/gym"
import { Button } from "@/components/ui/button"
import { RoutineDialog } from "@/components/routine-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"

export function GymRoutines({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["routines", uid], () => fetchRoutines(uid))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Routine | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null)

  const routines = data ?? []

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(r: Routine) {
    setEditing(r)
    setDialogOpen(true)
  }

  async function handleSubmit(input: RoutineInput) {
    if (editing) {
      await updateRoutine(uid, editing.id, input)
      toast.success("Rutina actualizada")
    } else {
      await createRoutine(uid, input)
      toast.success("Rutina creada")
    }
    await mutate()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const r = deleteTarget
    await mutate(
      async () => {
        await deleteRoutine(uid, r.id)
        return routines.filter((x) => x.id !== r.id)
      },
      { optimisticData: routines.filter((x) => x.id !== r.id), rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success("Rutina eliminada"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gym/12">
            <Dumbbell className="size-5 text-gym" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Rutinas</h2>
            <p className="text-sm text-muted-foreground">Plantillas de entrenamiento reutilizables.</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nueva</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      ) : routines.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {routines.map((r) => (
            <li key={r.id} className="group rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{r.name}</p>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(r)} aria-label="Editar rutina">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(r)}
                    aria-label="Eliminar rutina"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {r.exercises.map((ex, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="truncate">{ex.exerciseName}</span>
                    <span className="font-mono tabular-nums">
                      {ex.targetSets}×{ex.targetReps}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <p className="text-sm font-medium text-foreground">Aún no tienes rutinas</p>
          <p className="text-sm text-muted-foreground">Crea una plantilla para agilizar tus entrenamientos.</p>
        </div>
      )}

      <RoutineDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSubmit={handleSubmit} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar rutina?"
        description={`Esto elimina "${deleteTarget?.name}". Los entrenamientos ya registrados no se ven afectados.`}
        onConfirm={confirmDelete}
      />
    </section>
  )
}
