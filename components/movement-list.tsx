"use client"

import { ArrowDownLeft, ArrowUpRight, Lock, Pencil, Target, Trash2, Zap } from "lucide-react"
import type { Movement } from "@/lib/movements"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MovementListProps {
  movements: Movement[]
  onEdit: (m: Movement) => void
  onDelete: (m: Movement) => void
}

export function MovementList({ movements, onEdit, onDelete }: MovementListProps) {
  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">Aún no hay movimientos</p>
        <p className="text-sm text-muted-foreground">Añade tu primer ingreso o gasto para empezar.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {movements.map((m) => {
        const isIncome = m.type === "income"
        return (
          <li
            key={m.id}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                isIncome
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {isIncome ? (
                <ArrowUpRight className="size-5" aria-hidden="true" />
              ) : (
                <ArrowDownLeft className="size-5" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{m.category}</p>
                {m.automatic && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-finance/12 px-1.5 py-0.5 text-[10px] font-medium text-finance"
                    title="Importado automáticamente del banco"
                  >
                    <Zap className="size-2.5" aria-hidden="true" />
                    Auto
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {m.description || "Sin descripción"} · {formatDate(m.date)}
                {m.goalName && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-finance">
                    <Target className="size-3" aria-hidden="true" />
                    {m.goalName}
                  </span>
                )}
              </p>
            </div>

            <p
              className={cn(
                "shrink-0 font-mono font-semibold tabular-nums",
                isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {isIncome ? "+" : "−"}
              {formatCurrency(m.amount)}
            </p>

            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onEdit(m)}
                aria-label="Editar movimiento"
              >
                <Pencil className="size-4" />
              </Button>
              {m.automatic ? (
                <span
                  className="grid size-8 place-items-center text-muted-foreground/50"
                  title="Los movimientos automáticos no se pueden eliminar"
                >
                  <Lock className="size-4" aria-hidden="true" />
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(m)}
                  aria-label="Eliminar movimiento"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
