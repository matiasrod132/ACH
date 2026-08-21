import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { useEffect, useRef } from "react"
import useSWR, { type SWRResponse } from "swr"
import { db } from "@/lib/firebase"
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type Movement,
  type MovementInput,
  type MovementType,
} from "@/lib/movement-categories"

export type { Movement, MovementInput, MovementType }
export { INCOME_CATEGORIES, EXPENSE_CATEGORIES }

/** Subcollection reference: users/{uid}/financeMovements */
function movementsRef(uid: string) {
  if (!db) throw new Error("Firebase no está configurado")
  return collection(db, "users", uid, "financeMovements")
}

function firestore() {
  if (!db) throw new Error("Firebase no está configurado")
  return db
}

function parseMovementDoc(id: string, data: Record<string, unknown>): Movement {
  const createdAt = data.createdAt
  return {
    id,
    type: (data.type as MovementType) ?? "expense",
    amount: Number(data.amount ?? 0),
    category: (data.category as string) ?? "Otro",
    description: (data.description as string) ?? "",
    date: (data.date as string) ?? "",
    createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    automatic: Boolean(data.automatic) || undefined,
    merchant: (data.merchant as string) || undefined,
    source: (data.source as string) || undefined,
    goalId: (data.goalId as string) || undefined,
    goalName: (data.goalName as string) || undefined,
  }
}

/** ISO date string N months back from today — used to bound the default movements window. */
function monthsAgoISO(monthsBack: number): string {
  const d = new Date()
  d.setDate(1) // avoid month-length rollover surprises (e.g. Mar 31 - 1mo)
  d.setMonth(d.getMonth() - monthsBack)
  return d.toISOString().slice(0, 10)
}

/**
 * Fetches movements from the last `monthsBack` months (13 by default — enough to cover
 * any trailing 12-month report view). The bank-email sync writes continuously, so an
 * unbounded fetch would grow forever; bounding by date keeps reads/latency flat over time
 * without truncating anything the dashboard's monthly aggregates actually use.
 * Use `fetchAllMovements` when the full history is genuinely needed (e.g. export).
 */
export async function fetchMovements(uid: string, monthsBack = 13): Promise<Movement[]> {
  const q = query(movementsRef(uid), where("date", ">=", monthsAgoISO(monthsBack)), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => parseMovementDoc(d.id, d.data() as Record<string, unknown>))
}

/** Unbounded fetch of every movement ever recorded — for export/audit use, not routine UI. */
export async function fetchAllMovements(uid: string): Promise<Movement[]> {
  const q = query(movementsRef(uid), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => parseMovementDoc(d.id, d.data() as Record<string, unknown>))
}

/**
 * Live-subscribes to the same bounded window `fetchMovements` uses, so movements the
 * Banco Guayaquil sync writes in the background (every 5 min) appear without a manual refetch.
 * Returns the Firestore unsubscribe function.
 */
export function subscribeToMovements(
  uid: string,
  onChange: (movements: Movement[]) => void,
  monthsBack = 13,
): Unsubscribe {
  const q = query(movementsRef(uid), where("date", ">=", monthsAgoISO(monthsBack)), orderBy("date", "desc"))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => parseMovementDoc(d.id, d.data() as Record<string, unknown>)))
  })
}

/**
 * SWR-backed movements list that also stays live via `subscribeToMovements`, so movements
 * the bank-email sync writes in the background show up without a manual refetch. Drop-in
 * replacement for `useSWR(["movements", uid], () => fetchMovements(uid))`.
 */
export function useMovements(uid: string | undefined): SWRResponse<Movement[]> {
  const swr = useSWR(uid ? ["movements", uid] : null, () => fetchMovements(uid as string))
  const mutateRef = useRef(swr.mutate)
  mutateRef.current = swr.mutate

  useEffect(() => {
    if (!uid) return
    const unsubscribe = subscribeToMovements(uid, (movements) => {
      mutateRef.current(movements, { revalidate: false })
    })
    return unsubscribe
  }, [uid])

  return swr
}

export async function createMovement(uid: string, input: MovementInput): Promise<string> {
  const ref = await addDoc(movementsRef(uid), {
    ...input,
    amount: Number(input.amount),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMovement(uid: string, id: string, input: MovementInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "financeMovements", id), {
    ...input,
    amount: Number(input.amount),
  })
}

export async function deleteMovement(uid: string, id: string): Promise<void> {
  const ref = doc(firestore(), "users", uid, "financeMovements", id)
  const snap = await getDoc(ref)
  if (snap.data()?.automatic) {
    throw new Error("Los movimientos automáticos no se pueden eliminar")
  }
  await deleteDoc(ref)
}

/** Reads the monthly budget stored on the user doc (financeBudget). */
export async function fetchBudget(uid: string): Promise<number> {
  const snap = await getDoc(doc(firestore(), "users", uid))
  const data = snap.data() as Record<string, unknown> | undefined
  const value = Number(data?.financeBudget ?? 0)
  return Number.isFinite(value) ? value : 0
}

export async function saveBudget(uid: string, budget: number): Promise<void> {
  await setDoc(doc(firestore(), "users", uid), { financeBudget: Math.round(budget) }, { merge: true })
}

/* --------------------------------- Goals --------------------------------- */

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  /** ISO date string (YYYY-MM-DD), or null if the goal has no deadline. */
  targetDate: string | null
  createdAt: number | null
}

export interface GoalInput {
  name: string
  targetAmount: number
  targetDate: string | null
}

/** Subcollection reference: users/{uid}/financeGoals */
function goalsRef(uid: string) {
  if (!db) throw new Error("Firebase no está configurado")
  return collection(db, "users", uid, "financeGoals")
}

export async function fetchGoals(uid: string): Promise<Goal[]> {
  const snap = await getDocs(goalsRef(uid))
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      const createdAt = data.createdAt
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        targetAmount: Number(data.targetAmount ?? 0),
        currentAmount: Number(data.currentAmount ?? 0),
        targetDate: (data.targetDate as string) || null,
        createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
      }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function createGoal(uid: string, input: GoalInput): Promise<string> {
  const ref = await addDoc(goalsRef(uid), {
    name: input.name,
    targetAmount: Number(input.targetAmount),
    currentAmount: 0,
    targetDate: input.targetDate,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateGoal(uid: string, id: string, input: GoalInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "financeGoals", id), {
    name: input.name,
    targetAmount: Number(input.targetAmount),
    targetDate: input.targetDate,
  })
}

/** Adds (or, with a negative amount, removes) funds from a goal's progress. */
export async function contributeToGoal(uid: string, id: string, amount: number): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "financeGoals", id), {
    currentAmount: increment(amount),
  })
}

export async function deleteGoal(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "financeGoals", id))
}
