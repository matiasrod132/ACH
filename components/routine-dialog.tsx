"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type Routine, type RoutineExercise, type RoutineInput } from "@/lib/gym"
import { ExercisePicker } from "@/components/exercise-picker"

interface RoutineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Routine | null
  onSubmit: (input: RoutineInput) => Promise<void>
}

const emptyExercise = (): RoutineExercise => ({ exerciseName: "", targetSets: 3, targetReps: 10 })

export function RoutineDialog({ open, onOpenChange, editing, onSubmit }: RoutineDialogProps) {
  const [name, setName] = useState("")
  const [exercises, setExercises] = useState<RoutineExercise[]>([emptyExercise()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setExercises(editing.exercises.length > 0 ? editing.exercises : [emptyExercise()])
    } else {
      setName("")
      setExercises([emptyExercise()])
    }
    setError(null)
  }, [open, editing])

  function updateExercise(index: number, patch: Partial<RoutineExercise>) {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = exercises.filter((ex) => ex.exerciseName.trim())
    if (!name.trim()) {
      setError("Ponle un nombre a la rutina.")
      return
    }
    if (cleaned.length === 0) {
      setError("Agrega al menos un ejercicio.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), exercises: cleaned })
      onOpenChange(false)
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>
            {editing ? "Actualiza los ejercicios de la rutina." : "Crea una plantilla de entrenamiento reutilizable."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-name">Nombre</Label>
            <Input
              id="routine-name"
              placeholder="Ej. Día de empuje, Piernas..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ejercicios</Label>
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
              {exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ExercisePicker
                    value={ex.exerciseName}
                    onValueChange={(name) => updateExercise(i, { exerciseName: name })}
                    placeholder="Nombre del ejercicio"
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="1"
                    value={ex.targetSets}
                    onChange={(e) => updateExercise(i, { targetSets: Number.parseInt(e.target.value, 10) || 1 })}
                    aria-label="Series objetivo"
                    className="h-10 w-16 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm font-mono tabular-nums outline-none focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <input
                    type="number"
                    min="1"
                    value={ex.targetReps}
                    onChange={(e) => updateExercise(i, { targetReps: Number.parseInt(e.target.value, 10) || 1 })}
                    aria-label="Repeticiones objetivo"
                    className="h-10 w-16 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm font-mono tabular-nums outline-none focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeExercise(i)}
                    aria-label="Quitar ejercicio"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 gap-1.5 self-start"
              onClick={() => setExercises((prev) => [...prev, emptyExercise()])}
            >
              <Plus className="size-3.5" />
              Agregar ejercicio
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear rutina"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
