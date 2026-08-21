"use client"

import type React from "react"
import { useEffect, useState } from "react"
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
import type { Goal, GoalInput } from "@/lib/movements"

interface GoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this goal. Otherwise it creates one. */
  editing?: Goal | null
  onSubmit: (input: GoalInput) => Promise<void>
}

export function GoalDialog({ open, onOpenChange, editing, onSubmit }: GoalDialogProps) {
  const [name, setName] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setTargetAmount(String(editing.targetAmount))
      setTargetDate(editing.targetDate ?? "")
    } else {
      setName("")
      setTargetAmount("")
      setTargetDate("")
    }
    setError(null)
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numAmount = Number.parseFloat(targetAmount)
    if (!name.trim()) {
      setError("Ponle un nombre a la meta.")
      return
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Ingresa un monto objetivo mayor a 0.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        targetAmount: numAmount,
        targetDate: targetDate || null,
      })
      onOpenChange(false)
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>
            {editing ? "Actualiza los datos de la meta." : "Define un objetivo de ahorro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">Nombre</Label>
            <Input
              id="goal-name"
              placeholder="Ej. Vacaciones, fondo de emergencia..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
            <p className="text-xs text-muted-foreground">
              Si usas este nombre como motivo al transferir dinero, el sync de Banco
              Guayaquil la reconoce y suma el aporte solo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Monto objetivo (USD)</Label>
              <Input
                id="goal-target"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-date">Fecha límite (opcional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
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
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
