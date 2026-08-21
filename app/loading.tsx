import { Loader2, Zap } from 'lucide-react'

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <span className="grid size-12 place-items-center rounded-2xl bg-tasks/15 ring-1 ring-tasks/40">
        <Zap className="size-6 text-tasks" aria-hidden="true" />
      </span>
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Cargando StarkLab</p>
    </main>
  )
}
