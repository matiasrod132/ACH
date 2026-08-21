'use client'

import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/12">
        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-lg font-semibold tracking-tight">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ocurrió un error inesperado en StarkLab. Puedes intentar de nuevo.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground/60">Ref: {error.digest}</p>
        ) : null}
      </div>
      <Button type="button" variant="secondary" onClick={() => reset()}>
        <RotateCw aria-hidden="true" />
        Reintentar
      </Button>
    </main>
  )
}
