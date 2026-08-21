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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Movement,
  type MovementInput,
  type MovementType,
} from "@/lib/movements"
import { todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

interface MovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this movement. Otherwise it creates one. */
  editing?: Movement | null
  onSubmit: (input: MovementInput) => Promise<void>
}

const emptyState = (): MovementInput => ({
  type: "expense",
  amount: 0,
  category: "Otro",
  description: "",
  date: todayISO(),
})

export function MovementDialog({ open, onOpenChange, editing, onSubmit }: MovementDialogProps) {
  const [type, setType] = useState<MovementType>("expense")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Otro")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync form state when opening or switching between create/edit.
  useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type)
      setAmount(String(editing.amount))
      setCategory(editing.category)
      setDescription(editing.description)
      setDate(editing.date || todayISO())
    } else {
      const s = emptyState()
      setType(s.type)
      setAmount("")
      setCategory(s.category)
      setDescription(s.description)
      setDate(s.date)
    }
    setError(null)
  }, [open, editing])

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function handleTypeChange(next: MovementType) {
    setType(next)
    // Reset category to a valid one for the new type.
    const list = next === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!list.includes(category as never)) setCategory("Otro")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numAmount = Number.parseFloat(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Ingresa un monto mayor a 0.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        type,
        amount: numAmount,
        category,
        description: description.trim(),
        date,
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
          <DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>
            {editing ? "Actualiza los datos del movimiento." : "Registra un ingreso o un gasto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["expense", "income"] as MovementType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition-colors",
                  type === t
                    ? t === "income"
                      ? "bg-card text-emerald-600 shadow-sm dark:text-emerald-400"
                      : "bg-card text-destructive shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "income" ? "Ingreso" : "Gasto"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Monto (USD)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? '')}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              placeholder="Opcional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
            />
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
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Añadir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
