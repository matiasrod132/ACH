'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useGame, type Hobby, type HobbyColor } from '@/lib/game-context'
import { getHobbyIcon, COLOR_MAP, COLOR_OPTIONS, COLOR_LABELS, ICON_KEYS } from '@/lib/hobby-visuals'

export function HobbiesCard() {
  const { hobbies, tasks, expenses, addHobby, editHobby, deleteHobby } = useGame()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Hobby | null>(null)

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(h: Hobby) {
    setEditing(h)
    setEditorOpen(true)
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Tus hobbies</h2>
          <p className="text-sm text-muted-foreground">Los sistemas en los que subes de nivel.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-hobbies px-3 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar
        </button>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {hobbies.map((h) => {
          const Icon = getHobbyIcon(h.icon)
          const c = COLOR_MAP[h.color]
          const doneCount = tasks.filter((t) => t.hobbyId === h.id && t.done).length
          const taskCount = tasks.filter((t) => t.hobbyId === h.id).length
          const spent = expenses
            .filter((e) => e.hobbyId === h.id)
            .reduce((sum, e) => sum + e.amount, 0)
          return (
            <li
              key={h.id}
              className={`group relative flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-4 ring-1 ring-inset ${c.ring}`}
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${c.bg}`}>
                <Icon className={`size-5 ${c.text}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doneCount}/{taskCount} tareas · ${spent.toFixed(0)} gastado
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(h)}
                  aria-label={`Editar ${h.name}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteHobby(h.id)}
                  aria-label={`Eliminar ${h.name}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
        {hobbies.length === 0 && (
          <li className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aún no tienes hobbies. Agrega el primero para empezar a ganar XP.
          </li>
        )}
      </ul>

      {editorOpen && (
        <HobbyEditor
          hobby={editing}
          onClose={() => setEditorOpen(false)}
          onSave={(name, color, icon) => {
            if (editing) editHobby(editing.id, name, color, icon)
            else addHobby({ name, color, icon })
            setEditorOpen(false)
          }}
        />
      )}
    </section>
  )
}

function HobbyEditor({
  hobby,
  onClose,
  onSave,
}: {
  hobby: Hobby | null
  onClose: () => void
  onSave: (name: string, color: HobbyColor, icon: string) => void
}) {
  const [name, setName] = useState(hobby?.name ?? '')
  const [color, setColor] = useState<HobbyColor>(hobby?.color ?? 'indigo')
  const [icon, setIcon] = useState<string>(hobby?.icon ?? ICON_KEYS[0])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={hobby ? 'Editar hobby' : 'Agregar hobby'}
      onClick={onClose}
    >
      <div
        className="glass glow-hobbies w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {hobby ? 'Editar hobby' : 'Nuevo hobby'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hobby-name" className="text-sm font-medium">
              Nombre
            </label>
            <input
              id="hobby-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Guitarra"
              className="h-11 rounded-xl border border-input bg-secondary/40 px-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-hobbies/60 focus:ring-2 focus:ring-hobbies/15"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Ícono</span>
            <div className="flex flex-wrap gap-2">
              {ICON_KEYS.map((key) => {
                const Icon = getHobbyIcon(key)
                const active = key === icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    aria-label={`Ícono ${key}`}
                    aria-pressed={active}
                    className={`grid size-10 place-items-center rounded-xl border transition-all ${
                      active
                        ? 'border-transparent bg-hobbies/15 text-hobbies'
                        : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Color</span>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => {
                const active = c === color
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${COLOR_LABELS[c]}`}
                    aria-pressed={active}
                    className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border transition-all ${
                      active ? 'border-border bg-secondary/70' : 'border-border bg-secondary/30'
                    }`}
                  >
                    <span className={`size-3 rounded-full ${COLOR_MAP[c].dot}`} />
                    <span className="text-sm">{COLOR_LABELS[c]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), color, icon)}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-hobbies font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-50"
          >
            <Check className="size-4" aria-hidden="true" />
            {hobby ? 'Guardar cambios' : 'Crear hobby'}
          </button>
        </div>
      </div>
    </div>
  )
}
