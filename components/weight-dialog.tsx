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
import type { WeightInput } from "@/lib/nutrition"
import { todayISO } from "@/lib/format"
import { fromDisplayWeight, weightStep, type WeightUnit } from "@/lib/units"

interface WeightDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: WeightInput) => Promise<void>
  unit: WeightUnit
}

export function WeightDialog({ open, onOpenChange, onSubmit, unit }: WeightDialogProps) {
  const [weight, setWeight] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setWeight("")
    setDate(todayISO())
    setError(null)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number.parseFloat(weight)
    if (!Number.isFinite(value) || value <= 0) {
      setError(`Ingresa un peso válido en ${unit}.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ date, weightKg: fromDisplayWeight(value, unit) })
      onOpenChange(false)
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar peso</DialogTitle>
          <DialogDescription>Añade una nueva medición de peso corporal.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-kg">Peso ({unit})</Label>
            <Input
              id="weight-kg"
              type="number"
              inputMode="decimal"
              step={weightStep(unit)}
              min="0"
              placeholder={unit === "lb" ? "154" : "70.0"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-date">Fecha</Label>
            <Input id="weight-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
              {submitting ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
