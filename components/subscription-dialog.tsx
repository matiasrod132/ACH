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
import { EXPENSE_CATEGORIES } from "@/lib/movements"
import { BILLING_CYCLES, type BillingCycle, type Subscription, type SubscriptionInput } from "@/lib/subscriptions"
import { todayISO } from "@/lib/format"

interface SubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Subscription | null
  onSubmit: (input: SubscriptionInput) => Promise<void>
}

export function SubscriptionDialog({ open, onOpenChange, editing, onSubmit }: SubscriptionDialogProps) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Suscripción")
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [nextPaymentDate, setNextPaymentDate] = useState(todayISO())
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setAmount(String(editing.amount))
      setCategory(editing.category)
      setCycle(editing.cycle)
      setNextPaymentDate(editing.nextPaymentDate || todayISO())
      setActive(editing.active)
    } else {
      setName("")
      setAmount("")
      setCategory("Suscripción")
      setCycle("monthly")
      setNextPaymentDate(todayISO())
      setActive(true)
    }
    setError(null)
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numAmount = Number.parseFloat(amount)
    if (!name.trim()) {
      setError("Ponle un nombre a la suscripción.")
      return
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Ingresa un monto mayor a 0.")
      return
    }
    if (!nextPaymentDate) {
      setError("Selecciona la próxima fecha de cobro.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        amount: numAmount,
        category,
        cycle,
        nextPaymentDate,
        active,
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
          <DialogTitle>{editing ? "Editar suscripción" : "Nueva suscripción"}</DialogTitle>
          <DialogDescription>
            {editing ? "Actualiza los datos del cobro recurrente." : "Registra un pago recurrente para seguirle la pista."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-name">Nombre</Label>
            <Input
              id="sub-name"
              placeholder="Ej. Netflix, gimnasio, arriendo..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-amount">Monto (USD)</Label>
              <Input
                id="sub-amount"
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-cycle">Frecuencia</Label>
              <Select value={cycle} onValueChange={(value) => setCycle((value as BillingCycle) ?? "monthly")}>
                <SelectTrigger id="sub-cycle">
                  <SelectValue placeholder="Frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-category">Categoría</Label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? "Suscripción")}>
                <SelectTrigger id="sub-category">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sub-date">Próximo cobro</Label>
              <Input
                id="sub-date"
                type="date"
                value={nextPaymentDate}
                onChange={(e) => setNextPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-input accent-finance"
            />
            Activa (cuenta en próximos pagos y estadísticas)
          </label>

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
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear suscripción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
