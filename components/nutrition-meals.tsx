"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Utensils,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  createMeal,
  deleteMeal,
  fetchMeals,
  logFavoriteMeal,
  setMealFavorite,
  updateMeal,
  MEAL_TYPES,
  type Meal,
  type MealInput,
} from "@/lib/nutrition"
import { useGame } from "@/lib/game-context"
import { todayISO, parseISODate, dateToISO } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { MealDialog } from "@/components/meal-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"

function shiftDate(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return dateToISO(d)
}

export function NutritionMeals({ uid }: { uid: string }) {
  const { data, isLoading, mutate } = useSWR(["meals", uid], () => fetchMeals(uid))
  const { awardXp } = useGame()
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Meal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Meal | null>(null)

  const meals = data ?? []
  const dayMeals = useMemo(() => meals.filter((m) => m.date === selectedDate), [meals, selectedDate])

  const dayTotal = dayMeals.reduce((s, m) => s + m.calories, 0)

  const favorites = useMemo(() => {
    const byName = new Map<string, Meal>()
    for (const m of meals) {
      if (!m.favorite) continue
      const existing = byName.get(m.name)
      if (!existing || (m.createdAt ?? 0) > (existing.createdAt ?? 0)) byName.set(m.name, m)
    }
    return Array.from(byName.values())
  }, [meals])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(m: Meal) {
    setEditing(m)
    setDialogOpen(true)
  }

  async function handleSubmit(input: MealInput) {
    if (editing) {
      await updateMeal(uid, editing.id, input)
      toast.success("Comida actualizada")
    } else {
      await createMeal(uid, input)
      toast.success("Comida registrada")
      awardXp(8, "Comida registrada")
    }
    await mutate()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const m = deleteTarget
    await mutate(
      async () => {
        await deleteMeal(uid, m.id)
        return meals.filter((x) => x.id !== m.id)
      },
      { optimisticData: meals.filter((x) => x.id !== m.id), rollbackOnError: true, revalidate: false },
    )
      .then(() => toast.success("Comida eliminada"))
      .catch(() => toast.error("No se pudo eliminar"))
  }

  async function toggleFavorite(m: Meal) {
    const optimistic = meals.map((x) => (x.id === m.id ? { ...x, favorite: !x.favorite } : x))
    await mutate(
      async () => {
        await setMealFavorite(uid, m.id, !m.favorite)
        return optimistic
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    ).catch(() => toast.error("No se pudo actualizar"))
  }

  async function quickAdd(template: Meal) {
    await logFavoriteMeal(uid, template, selectedDate)
    await mutate()
    toast.success(`${template.name} añadido`)
    awardXp(8, "Comida registrada")
  }

  return (
    <div className="flex flex-col gap-5">
      {favorites.length > 0 && (
        <section className="glass rounded-3xl p-5 sm:p-6">
          <header className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-[oklch(0.8_0.16_70_/_0.14)]">
              <Star className="size-5 text-[oklch(0.7_0.16_70)]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Favoritos</h2>
              <p className="text-sm text-muted-foreground">Un toque para volver a registrarlas hoy.</p>
            </div>
          </header>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => quickAdd(f)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm hover:bg-secondary/70"
              >
                <Zap className="size-3.5 text-[oklch(0.7_0.16_70)]" aria-hidden="true" />
                {f.name}
                <span className="text-xs text-muted-foreground">{f.calories} kcal</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
              <Utensils className="size-5 text-nutrition" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Comidas</h2>
              <p className="text-sm text-muted-foreground">
                {dayMeals.length} registradas · {dayTotal} kcal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                aria-label="Día anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 rounded-lg bg-transparent px-1 text-sm outline-none"
                aria-label="Fecha"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                aria-label="Día siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nueva</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : dayMeals.length > 0 ? (
          <div className="flex flex-col gap-4">
            {MEAL_TYPES.map(({ value, label }) => {
              const group = dayMeals.filter((m) => m.type === value)
              if (group.length === 0) return null
              const subtotal = group.reduce((s, m) => s + m.calories, 0)
              return (
                <div key={value}>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{label}</span>
                    <span className="font-mono tabular-nums">{subtotal} kcal</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.map((m) => (
                      <li key={m.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(m)}
                          aria-label={m.favorite ? "Quitar de favoritos" : "Marcar como favorita"}
                          className="shrink-0"
                        >
                          <Star
                            className={`size-4 ${m.favorite ? "fill-[oklch(0.8_0.16_70)] text-[oklch(0.8_0.16_70)]" : "text-muted-foreground"}`}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.protein}p / {m.carbs}c / {m.fat}g
                          </p>
                        </div>
                        <span className="shrink-0 font-mono font-semibold tabular-nums">{m.calories} kcal</span>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(m)} aria-label="Editar comida">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}
                            aria-label="Eliminar comida"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Sin comidas registradas este día.</p>
        )}
      </section>

      <MealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultDate={selectedDate}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar comida?"
        description={`Esto elimina "${deleteTarget?.name}" del registro.`}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
