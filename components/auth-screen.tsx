'use client'

import { Zap } from 'lucide-react'
import { AuthComponent } from '@/components/ui/sign-up'

export function AuthScreen() {
  return (
    <AuthComponent
      brandName="StarkLab"
      tagline="Convertí tus hábitos en un juego que ganás: XP, rachas y niveles en finanzas, gimnasio, nutrición y más."
      logo={
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Zap className="size-4" aria-hidden="true" />
        </span>
      }
    />
  )
}
