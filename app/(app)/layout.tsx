'use client'

import { GameProvider, useGame } from '@/lib/game-context'
import { AuthScreen } from '@/components/auth-screen'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'

/**
 * Renders AuthScreen immediately whenever there's no confirmed user yet —
 * including while `authLoading` is still resolving — instead of a
 * full-page spinner. A blocking spinner meant the server-rendered HTML
 * (what a crawler or Google's OAuth verification check sees) never showed
 * StarkLab's name/description, only an empty loading state. Firebase Auth's
 * local persistence resolves fast, so a returning logged-in user sees at
 * most a brief flash of AuthScreen before AppShell takes over.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { user } = useGame()

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
