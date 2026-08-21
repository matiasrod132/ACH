// Shared between client (Ajustes selector) and server (lib/server/bank-sync.ts) —
// no Firestore/Node-only imports here, safe to import from either side.

export interface BankProfile {
  id: string
  name: string
  senderAddresses: string[]
  subjectPatterns: string[]
}

/**
 * Only banks whose real notification-email format has actually been
 * confirmed go here — never guess a sender/subject pattern for a bank
 * nobody has seen a real sample from (same rule apps-script/Code.gs
 * documents for why Banco Guayaquil's own patterns are as narrow as they
 * are). Users of any other bank use the "custom" path in Ajustes instead,
 * supplying their own bank's real sender/subject.
 */
export const BANK_PROFILES: BankProfile[] = [
  {
    id: 'guayaquil',
    name: 'Banco Guayaquil',
    senderAddresses: ['BancoGuayaquil@bancoguayaquil.com', 'bancavirtual@bancoguayaquil.com'],
    subjectPatterns: ['Consumo por', 'Orden de'],
  },
]

export interface CustomBankConfig {
  senderAddresses: string[]
  subjectPatterns: string[]
}

export interface UserBankSelection {
  bankId: string // one of BANK_PROFILES' ids, or "custom"
  custom?: CustomBankConfig
}

export const DEFAULT_BANK_SELECTION: UserBankSelection = { bankId: 'guayaquil' }

export function resolveBankProfile(selection: UserBankSelection | undefined): BankProfile {
  if (!selection) return BANK_PROFILES[0]

  if (selection.bankId === 'custom') {
    return {
      id: 'custom',
      name: 'Banco personalizado',
      senderAddresses: selection.custom?.senderAddresses?.filter(Boolean) ?? [],
      subjectPatterns: selection.custom?.subjectPatterns?.filter(Boolean) ?? [],
    }
  }

  return BANK_PROFILES.find((b) => b.id === selection.bankId) ?? BANK_PROFILES[0]
}
