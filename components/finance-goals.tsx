"use client"

import { useState } from "react"
import useSWR from "swr"
import { Target, Plus, Pencil, Trash2, PartyPopper, CalendarClock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  fetchGoals,
  updateGoal,
  type Goal,
  type GoalInput,
} from "@/lib/movements"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { GoalDialog } from "@/components/goal-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"

function daysLeft(targetDate: string | null): number | null {
  if (!targetDate) return null
  const [y, m, d] = targetDate.split("-").map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d).getTime()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((target - todayStart) / 86_400_000)
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
}: {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
  onContribute: (amount: number) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0
  const complete = goal.currentAmount >= goal.targetAmount
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const left = daysLeft(goal.targetDate)

  async function submitContribution() {
    const value = Number.parseFloat(amount)
    if (!Number.isFinite(value) || value === 0) return
    setSubmitting(true)
    try {
      await onContribute(value)
      setAmount("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <li className="group rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{goal.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {goal.targetDate ? (
              <>
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {left !== null && left >= 0 ? `${left} días restantes` : "Fecha vencida"} · {formatDate(goal.targetDate)}
              </>
            ) : (
              "Sin fecha límite"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label="Editar meta">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Eliminar meta"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-finance transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">
          {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
        </span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>

      {complete ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-finance/10 px-3 py-2 text-sm text-finance">
          <PartyPopper className="size-4" aria-hidden="true" />
          ¡Meta completada!
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) submitContribution()
              }}
              placeholder={`Faltan ${formatCurrency(remaining)}`}
              aria-label={`Agregar fondos a ${goal.name}`}
              className="h-9 w-full rounded-lg border border-input bg-secondary/40 pl-6 pr-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-finance/60 focus:ring-2 focus:ring-finance/20"
            />
          </div>
          <Button size="sm" onClick={submitContribution} disabled={!amount || submitting} className="h-9 gap-1">
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Agregar
          </Button>
        </div>
      )}
    </li>
  )
}

export function FinanceGoals({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["goals", uid], () => fetchGoals(uid))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)

  const goals = data ?? []

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(g: Goal) {
    setEditing(g)
    setDialogOpen(true)
  }

  async function handleSubmit(input: GoalInput) {
    if (editing) {
      await updateGoal(uid, editing.id, input)
      toast.success("Meta actualizada")
    } else {
      await createGoal(uid, input)
      toast.success("Meta creada")
    }
    await mutate()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const g = deleteTarget
    await mutate(
      async () => {
        await deleteGoal(uid, g.id)
        return goals.filter((x) => x.id !== g.id)
      },
      {
        optimisticData: goals.filter((x) => x.id !== g.id),
        rollbackOnError: true,
        revalidate: false,
      },
    )
      .then(() => toast.success("Meta eliminada"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  async function handleContribute(g: Goal, amount: number) {
    const optimistic = goals.map((x) =>
      x.id === g.id ? { ...x, currentAmount: x.currentAmount + amount } : x,
    )
    await mutate(
      async () => {
        await contributeToGoal(uid, g.id, amount)
        return optimistic
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success(amount > 0 ? "Fondos agregados" : "Fondos retirados"))
      .catch(() => toast.error("No se pudo actualizar la meta"))
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
            <Target className="size-5 text-finance" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Metas de ahorro</h2>
            <p className="text-sm text-muted-foreground">Define objetivos y sigue tu progreso.</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nueva meta</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Cargando metas...</span>
        </div>
      ) : goals.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={() => openEdit(g)}
              onDelete={() => setDeleteTarget(g)}
              onContribute={(amount) => handleContribute(g, amount)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Aún no tienes metas</p>
          <p className="text-sm text-muted-foreground">Crea una meta para empezar a ahorrar con propósito.</p>
        </div>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar meta"
        description={
          deleteTarget
            ? `Se eliminará la meta "${deleteTarget.name}" y su progreso (${formatCurrency(deleteTarget.currentAmount)}). Esta acción no se puede deshacer.`
            : ""
        }
        onConfirm={confirmDelete}
      />
    </section>
  )
}
