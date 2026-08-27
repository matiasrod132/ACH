'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Syncs a dashboard page's internal tab state with the `?tab=` URL query
 * param. This is what lets the sidebar deep-link into a specific tab (e.g.
 * `/finanzas?tab=movimientos`), keeps the browser back button working, and
 * survives a reload. The default tab is kept out of the URL (`/finanzas`
 * alone means "resumen").
 */
export function usePageTab<T extends string>(values: readonly T[], defaultValue: T) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isValid = useCallback((v: string | null): v is T => (values as readonly string[]).includes(v ?? ''), [values])

  const [tab, setTabState] = useState<T>(() => {
    const param = searchParams.get('tab')
    return isValid(param) ? param : defaultValue
  })

  // Keeps state in sync when the URL changes from outside this component —
  // e.g. a sidebar link to a different tab on the same route.
  useEffect(() => {
    const param = searchParams.get('tab')
    const next = isValid(param) ? param : defaultValue
    setTabState((prev) => (prev === next ? prev : next))
  }, [searchParams, isValid, defaultValue])

  const setTab = useCallback(
    (next: T) => {
      setTabState(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === defaultValue) params.delete('tab')
      else params.set('tab', next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname, defaultValue],
  )

  return [tab, setTab] as const
}
