'use client'

import { Loader2, Zap } from 'lucide-react'
import { GameProvider, useGame } from '@/lib/game-context'
import { AuthScreen } from '@/components/auth-screen'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'

function Gate({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useGame()

  if (authLoading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-tasks/15">
          <Zap className="size-6 text-tasks" aria-hidden="true" />
        </span>
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Cargando StarkLab</span>
      </main>
    )
  }

  return user ? <AppShell>{children}</AppShell> : <AuthScreen />
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <Gate>{children}</Gate>
      <Toaster />
    </GameProvider>
  )
}
