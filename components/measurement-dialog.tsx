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
import { MEASUREMENT_FIELDS, type MeasurementInput, type MeasurementFields } from "@/lib/measurements"
import { todayISO } from "@/lib/format"

interface MeasurementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: MeasurementInput) => Promise<void>
}

type FormState = Record<keyof MeasurementFields, string>

const emptyForm = (): FormState =>
  Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, ""])) as FormState

export function MeasurementDialog({ open, onOpenChange, onSubmit }: MeasurementDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setDate(todayISO())
    setError(null)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const values = MEASUREMENT_FIELDS.map((f) => Number.parseFloat(form[f.key]))
    const hasAny = values.some((v) => Number.isFinite(v) && v > 0)
    if (!hasAny) {
      setError("Ingresa al menos una medida.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const input: MeasurementInput = { date } as MeasurementInput
      for (const f of MEASUREMENT_FIELDS) {
        const v = Number.parseFloat(form[f.key])
        input[f.key] = Number.isFinite(v) && v > 0 ? v : null
      }
      await onSubmit(input)
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
          <DialogTitle>Registrar medidas</DialogTitle>
          <DialogDescription>Deja en blanco lo que no quieras medir hoy. Todo en cm.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={`measure-${f.key}`}>{f.label} (cm)</Label>
                <Input
                  id={`measure-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="—"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="measure-date">Fecha</Label>
            <Input id="measure-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
