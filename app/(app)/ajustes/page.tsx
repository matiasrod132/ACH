'use client'

import { Suspense } from 'react'
import { SettingsSection } from '@/components/settings-section'

export default function AjustesPage() {
  return (
    <Suspense fallback={null}>
      <SettingsSection />
    </Suspense>
  )
}
