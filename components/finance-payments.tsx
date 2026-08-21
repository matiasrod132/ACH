"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  CalendarClock,
  Check,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { createMovement } from "@/lib/movements"
import {
  deleteSubscription,
  fetchSubscriptions,
  markSubscriptionPaid,
  BILLING_CYCLES,
  type Subscription,
  type SubscriptionInput,
  createSubscription,
  updateSubscription,
} from "@/lib/subscriptions"
import { formatCurrency, formatDate, parseISODate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { SubscriptionDialog } from "@/components/subscription-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"

function daysUntil(iso: string): number {
  const target = parseISODate(iso)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - todayStart.getTime()) / 86_400_000)
}

function urgencyLabel(days: number): { text: string; tone: string } {
  if (days < 0) return { text: `Vencido hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`, tone: "text-destructive" }
  if (days === 0) return { text: "Vence hoy", tone: "text-destructive" }
  if (days <= 3) return { text: `En ${days} día${days === 1 ? "" : "s"}`, tone: "text-[oklch(0.6_0.18_60)]" }
  return { text: `En ${days} días`, tone: "text-muted-foreground" }
}

function cycleLabel(cycle: Subscription["cycle"]): string {
  return BILLING_CYCLES.find((c) => c.value === cycle)?.label ?? cycle
}

export function FinancePayments({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["subscriptions", uid], () => fetchSubscriptions(uid))
  const { mutate: mutateMovements } = useSWR(["movements", uid])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  const subscriptions = data ?? []

  const upcoming = useMemo(
    () =>
      subscriptions
        .filter((s) => s.active)
        .map((s) => ({ sub: s, days: daysUntil(s.nextPaymentDate) }))
        .sort((a, b) => a.days - b.days),
    [subscriptions],
  )

  const monthlyTotal = useMemo(() => {
    return subscriptions
      .filter((s) => s.active)
      .reduce((sum, s) => {
        if (s.cycle === "monthly") return sum + s.amount
        if (s.cycle === "weekly") return sum + s.amount * 4.345
        return sum + s.amount / 12
      }, 0)
  }, [subscriptions])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(s: Subscription) {
    setEditing(s)
    setDialogOpen(true)
  }

  async function handleSubmit(input: SubscriptionInput) {
    if (editing) {
      await updateSubscription(uid, editing.id, input)
      toast.success("Suscripción actualizada")
    } else {
      await createSubscription(uid, input)
      toast.success("Suscripción creada")
    }
    await mutate()
  }

  async function toggleActive(s: Subscription) {
    await mutate(
      async () => {
        await updateSubscription(uid, s.id, { ...s, active: !s.active })
        return subscriptions.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x))
      },
      {
        optimisticData: subscriptions.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)),
        rollbackOnError: true,
        revalidate: false,
      },
    ).catch(() => toast.error("No se pudo actualizar"))
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const s = deleteTarget
    await mutate(
      async () => {
        await deleteSubscription(uid, s.id)
        return subscriptions.filter((x) => x.id !== s.id)
      },
      {
        optimisticData: subscriptions.filter((x) => x.id !== s.id),
        rollbackOnError: true,
        revalidate: false,
      },
    )
      .then(() => toast.success("Suscripción eliminada"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  async function handleMarkPaid(s: Subscription) {
    setPaying(s.id)
    try {
      const nextDate = await markSubscriptionPaid(uid, s)
      await createMovement(uid, {
        type: "expense",
        amount: s.amount,
        category: s.category,
        description: `Suscripción: ${s.name}`,
        date: s.nextPaymentDate,
      })
      await mutate()
      await mutateMovements()
      toast.success(`Pago registrado. Próximo cobro: ${formatDate(nextDate)}`)
    } catch {
      toast.error("No se pudo registrar el pago")
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
              <CalendarClock className="size-5 text-finance" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Próximos pagos</h2>
              <p className="text-sm text-muted-foreground">
                ~<span className="font-mono tabular-nums">{formatCurrency(monthlyTotal)}</span>/mes en suscripciones activas
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : upcoming.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map(({ sub, days }) => {
              const urgency = urgencyLabel(days)
              return (
                <li
                  key={sub.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{sub.name}</p>
                    <p className={`text-xs ${urgency.tone}`}>
                      {urgency.text} · {formatDate(sub.nextPaymentDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono font-semibold tabular-nums">{formatCurrency(sub.amount)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    disabled={paying === sub.id}
                    onClick={() => handleMarkPaid(sub)}
                  >
                    {paying === sub.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Pagado
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No tienes suscripciones activas.</p>
        )}
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
              <Repeat className="size-5 text-finance" aria-hidden="true" />
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight">Tus suscripciones</h2>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        </div>

        {subscriptions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className={`group flex items-center gap-3 rounded-xl border border-border bg-card p-3 ${
                  s.active ? "" : "opacity-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {cycleLabel(s.cycle)} · {s.category} · próximo: {formatDate(s.nextPaymentDate)}
                  </p>
                </div>
                <span className="shrink-0 font-mono font-semibold tabular-nums">{formatCurrency(s.amount)}</span>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => toggleActive(s)}
                    aria-label={s.active ? "Pausar suscripción" : "Reactivar suscripción"}
                  >
                    {s.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(s)} aria-label="Editar suscripción">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(s)}
                    aria-label="Eliminar suscripción"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
            <p className="text-sm font-medium text-foreground">Aún no tienes suscripciones</p>
            <p className="text-sm text-muted-foreground">Registra pagos recurrentes para no perderles la pista.</p>
          </div>
        )}
      </section>

      <SubscriptionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar suscripción?"
        description={`Esto elimina "${deleteTarget?.name}" de tu lista. No borra movimientos ya registrados.`}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
