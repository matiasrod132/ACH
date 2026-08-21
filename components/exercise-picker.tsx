"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Search, ChevronDown } from "lucide-react"
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, type ExerciseDef } from "@/lib/gym"
import { ExerciseImage } from "@/components/exercise-image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const MAX_RESULTS = 60
const ALL = "Todos"
const DIACRITICS_RE = /[̀-ͯ]/g

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "")
}

const EQUIPMENT_OPTIONS = [ALL, ...Array.from(new Set(EXERCISE_LIBRARY.map((e) => e.equipment))).sort((a, b) => a.localeCompare(b, "es"))]
const MUSCLE_OPTIONS = [ALL, ...MUSCLE_GROUPS]

function filterExercises(query: string, muscle: string, equipment: string): ExerciseDef[] {
  const q = normalize(query.trim())
  const starts: ExerciseDef[] = []
  const contains: ExerciseDef[] = []
  for (const ex of EXERCISE_LIBRARY) {
    if (muscle !== ALL && ex.muscleGroup !== muscle) continue
    if (equipment !== ALL && ex.equipment !== equipment) continue
    if (!q) {
      starts.push(ex)
      continue
    }
    const n = normalize(ex.name)
    if (n.startsWith(q)) starts.push(ex)
    else if (n.includes(q)) contains.push(ex)
  }
  return [...starts, ...contains]
}

interface ExercisePickerProps {
  value: string
  onValueChange: (name: string) => void
  placeholder?: string
  className?: string
  /**
   * Called with the picked name right after a selection is made (from the list or
   * confirmed as free text). Receives the name directly — rather than relying on the
   * caller reading it back from state — since onValueChange's state update hasn't
   * committed yet when this fires in the same synchronous handler.
   */
  onSelect?: (name: string) => void
  autoFocus?: boolean
}

/** Exercise picker: a trigger field that opens a popup with search, muscle group and equipment filters. */
export function ExercisePicker({ value, onValueChange, placeholder, className, onSelect, autoFocus }: ExercisePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [muscle, setMuscle] = useState(ALL)
  const [equipment, setEquipment] = useState(ALL)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(value)
      setMuscle(ALL)
      setEquipment(ALL)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, value])

  const results = useMemo(() => filterExercises(query, muscle, equipment), [query, muscle, equipment])
  const shown = results.slice(0, MAX_RESULTS)
  const exactMatch = results.some((ex) => normalize(ex.name) === normalize(query.trim()))

  function pick(name: string) {
    onValueChange(name)
    setOpen(false)
    onSelect?.(name)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (shown[0]) pick(shown[0].name)
      else if (query.trim()) pick(query.trim())
    }
  }

  const currentDef = value ? EXERCISE_LIBRARY.find((e) => e.name === value) : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        autoFocus={autoFocus}
        className={`flex h-14 w-full items-center gap-3 rounded-lg border border-input bg-secondary/40 px-3 text-left text-sm outline-none focus:border-gym/60 focus:ring-2 focus:ring-gym/15 ${className ?? ""}`}
      >
        {currentDef ? (
          <ExerciseImage exerciseName={currentDef.name} className="size-10 shrink-0 rounded-md" />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        )}
        <span className={`min-w-0 flex-1 truncate text-base ${value ? "" : "text-muted-foreground/60"}`}>
          {value || placeholder}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Elegir ejercicio</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar ejercicio..."
                className="h-11 w-full rounded-lg border border-input bg-secondary/40 py-2 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground/60 focus:border-gym/60 focus:ring-2 focus:ring-gym/15"
              />
            </div>

            <FilterRow label="Músculo" options={MUSCLE_OPTIONS} active={muscle} onChange={setMuscle} />
            <FilterRow label="Equipo" options={EQUIPMENT_OPTIONS} active={equipment} onChange={setEquipment} />
          </div>

          <div className="mt-1 flex-1 overflow-y-auto border-t border-border p-3">
            {query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => pick(query.trim())}
                className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-gym/40 px-3 py-2.5 text-left text-sm font-medium text-gym transition-colors hover:bg-gym/10"
              >
                Usar “{query.trim()}” como nombre libre
              </button>
            )}
            {shown.length === 0 ? (
              <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
                No hay ejercicios que coincidan con esos filtros.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {shown.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => pick(ex.name)}
                    className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-gym/50 hover:bg-secondary/40"
                  >
                    <ExerciseImage exerciseName={ex.name} className="aspect-square w-full rounded-none" />
                    <span className="flex flex-col gap-0.5 p-2.5">
                      <span className="line-clamp-2 text-sm font-medium leading-snug">{ex.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {ex.muscleGroup} · {ex.equipment}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {results.length > MAX_RESULTS && (
              <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                Mostrando {MAX_RESULTS} de {results.length} — afina la búsqueda o los filtros para ver más.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FilterRow({
  label,
  options,
  active,
  onChange,
}: {
  label: string
  options: string[]
  active: string
  onChange: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const collapsed = options.slice(0, 8)
  const visible = expanded ? options : collapsed.includes(active) ? collapsed : [options[0], active, ...collapsed.slice(1).filter((o) => o !== active)]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs font-medium text-muted-foreground">{label}:</span>
      {visible.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            active === opt
              ? "border-gym/60 bg-gym/15 text-gym"
              : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
          }`}
        >
          {opt}
        </button>
      ))}
      {options.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "menos" : "más"}
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
