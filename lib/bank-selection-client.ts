import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_BANK_SELECTION, type UserBankSelection } from '@/lib/bank-profiles'

export async function fetchBankSelection(uid: string): Promise<UserBankSelection> {
  if (!db) return DEFAULT_BANK_SELECTION
  const snap = await getDoc(doc(db, 'users', uid))
  const stored = snap.data()?.bankSelection as UserBankSelection | undefined
  return stored ?? DEFAULT_BANK_SELECTION
}

export async function saveBankSelection(uid: string, selection: UserBankSelection): Promise<void> {
  if (!db) return
  await setDoc(doc(db, 'users', uid), { bankSelection: selection }, { merge: true })
}
