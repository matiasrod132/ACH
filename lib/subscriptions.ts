import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { dateToISO, parseISODate } from "@/lib/format"

export type BillingCycle = "weekly" | "monthly" | "yearly"

export const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
]

export interface Subscription {
  id: string
  name: string
  amount: number
  category: string
  cycle: BillingCycle
  /** ISO date (YYYY-MM-DD) of the next charge. */
  nextPaymentDate: string
  active: boolean
  createdAt: number | null
}

export interface SubscriptionInput {
  name: string
  amount: number
  category: string
  cycle: BillingCycle
  nextPaymentDate: string
  active: boolean
}

function firestore() {
  if (!db) throw new Error("Firebase no está configurado")
  return db
}

function subscriptionsRef(uid: string) {
  return collection(firestore(), "users", uid, "financeSubscriptions")
}

export async function fetchSubscriptions(uid: string): Promise<Subscription[]> {
  const snap = await getDocs(subscriptionsRef(uid))
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      const createdAt = data.createdAt
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        amount: Number(data.amount ?? 0),
        category: (data.category as string) ?? "Suscripción",
        cycle: (data.cycle as BillingCycle) ?? "monthly",
        nextPaymentDate: (data.nextPaymentDate as string) ?? "",
        active: data.active !== false,
        createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
      }
    })
    .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate))
}

export async function createSubscription(uid: string, input: SubscriptionInput): Promise<string> {
  const ref = await addDoc(subscriptionsRef(uid), {
    name: input.name,
    amount: Number(input.amount),
    category: input.category,
    cycle: input.cycle,
    nextPaymentDate: input.nextPaymentDate,
    active: input.active,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateSubscription(uid: string, id: string, input: SubscriptionInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "financeSubscriptions", id), {
    name: input.name,
    amount: Number(input.amount),
    category: input.category,
    cycle: input.cycle,
    nextPaymentDate: input.nextPaymentDate,
    active: input.active,
  })
}

export async function deleteSubscription(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "financeSubscriptions", id))
}

/** Rolls a date forward by one billing cycle, in local time. */
export function advanceByCycle(iso: string, cycle: BillingCycle): string {
  const date = parseISODate(iso)
  if (cycle === "weekly") date.setDate(date.getDate() + 7)
  else if (cycle === "monthly") date.setMonth(date.getMonth() + 1)
  else date.setFullYear(date.getFullYear() + 1)
  return dateToISO(date)
}

/** Advances nextPaymentDate until it's in the future, in case several cycles were missed. */
export async function markSubscriptionPaid(uid: string, sub: Subscription): Promise<string> {
  const todayIso = dateToISO(new Date())
  let next = advanceByCycle(sub.nextPaymentDate, sub.cycle)
  let guard = 0
  while (next <= todayIso && guard < 500) {
    next = advanceByCycle(next, sub.cycle)
    guard++
  }
  await updateDoc(doc(firestore(), "users", uid, "financeSubscriptions", sub.id), {
    nextPaymentDate: next,
  })
  return next
}
