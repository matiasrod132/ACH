// Pure types/constants only — no Firestore, no React. Both lib/movements.ts
// (client) and lib/server/bank-sync.ts (server route handler) import from
// here, so the server bundle never accidentally pulls in client-only hooks
// through lib/movements.ts's `useMovements` (Next.js's server/client
// boundary check rejects that combination at build time).

export type MovementType = 'income' | 'expense'

export interface Movement {
  id: string
  type: MovementType
  amount: number
  category: string
  description: string
  /** ISO date string (YYYY-MM-DD) chosen by the user */
  date: string
  createdAt: number | null
  /** Set on movements created by the Banco Guayaquil email sync. */
  automatic?: boolean
  /** Merchant/counterparty extracted from the source, when available. */
  merchant?: string
  /** Origin of the movement, e.g. "banco_guayaquil_email" / "gmail_oauth_sync". Absent for manual entries. */
  source?: string
  /** Set when the bank sync matched this movement to a goal by name and contributed to it. */
  goalId?: string
  goalName?: string
}

/** Payload used when creating/updating a movement (no id / server fields). */
export interface MovementInput {
  type: MovementType
  amount: number
  category: string
  description: string
  date: string
}

/**
 * Shared with apps-script/Code.gs and lib/server/bank-sync.ts — keep all
 * three in sync so movements created by any sync path always land on a
 * category the UI knows.
 */
export const INCOME_CATEGORIES = [
  'Salario',
  'Transferencia',
  'Reembolso',
  'Inversión',
  'Venta',
  'Ahorro',
  'Otro',
] as const

export const EXPENSE_CATEGORIES = [
  'Comida',
  'Transporte',
  'Servicios',
  'Entretenimiento',
  'Salud',
  'Educación',
  'Suscripción',
  'Compras',
  'Ahorro',
  'Retiro',
  'Otro',
] as const
