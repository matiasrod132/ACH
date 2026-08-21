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
import { MEAL_TYPES, type Meal, type MealInput, type MealType } from "@/lib/nutrition"
import { todayISO } from "@/lib/format"

interface MealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Meal | null
  defaultDate?: string
  onSubmit: (input: MealInput) => Promise<void>
}

export function MealDialog({ open, onOpenChange, editing, defaultDate, onSubmit }: MealDialogProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<MealType>("breakfast")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setCalories(String(editing.calories))
      setProtein(String(editing.protein))
      setCarbs(String(editing.carbs))
      setFat(String(editing.fat))
      setDate(editing.date || todayISO())
    } else {
      setName("")
      setType("breakfast")
      setCalories("")
      setProtein("")
      setCarbs("")
      setFat("")
      setDate(defaultDate || todayISO())
    }
    setError(null)
  }, [open, editing, defaultDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cal = Number.parseInt(calories, 10)
    if (!name.trim()) {
      setError("Ponle un nombre a la comida.")
      return
    }
    if (!Number.isFinite(cal) || cal <= 0) {
      setError("Ingresa calorías mayores a 0.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        calories: cal,
        protein: Number.parseInt(protein, 10) || 0,
        carbs: Number.parseInt(carbs, 10) || 0,
        fat: Number.parseInt(fat, 10) || 0,
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
          <DialogTitle>{editing ? "Editar comida" : "Nueva comida"}</DialogTitle>
          <DialogDescription>
            {editing ? "Actualiza los datos de la comida." : "Registra lo que comiste."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-name">Nombre</Label>
            <Input
              id="meal-name"
              placeholder="Ej. Pollo con arroz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-type">Tipo</Label>
              <Select value={type} onValueChange={(value) => setType((value as MealType) ?? "snack")}>
                <SelectTrigger id="meal-type">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-date">Fecha</Label>
              <Input id="meal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-calories">kcal</Label>
              <Input
                id="meal-calories"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-protein">Prot. g</Label>
              <Input
                id="meal-protein"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-carbs">Carb. g</Label>
              <Input
                id="meal-carbs"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-fat">Grasa g</Label>
              <Input
                id="meal-fat"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
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
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
