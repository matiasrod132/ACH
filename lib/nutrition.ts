import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { WeightUnit } from "@/lib/units"

function firestore() {
  if (!db) throw new Error("Firebase no está configurado")
  return db
}

/* --------------------------------- Meals --------------------------------- */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Desayuno" },
  { value: "lunch", label: "Almuerzo" },
  { value: "dinner", label: "Cena" },
  { value: "snack", label: "Snack" },
]

export interface Meal {
  id: string
  name: string
  type: MealType
  calories: number
  protein: number
  carbs: number
  fat: number
  /** ISO date (YYYY-MM-DD) the meal was eaten. */
  date: string
  favorite: boolean
  createdAt: number | null
}

export interface MealInput {
  name: string
  type: MealType
  calories: number
  protein: number
  carbs: number
  fat: number
  date: string
}

function mealsRef(uid: string) {
  return collection(firestore(), "users", uid, "nutritionMeals")
}

export async function fetchMeals(uid: string): Promise<Meal[]> {
  const q = query(mealsRef(uid), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const createdAt = data.createdAt
    return {
      id: d.id,
      name: (data.name as string) ?? "",
      type: (data.type as MealType) ?? "snack",
      calories: Number(data.calories ?? 0),
      protein: Number(data.protein ?? 0),
      carbs: Number(data.carbs ?? 0),
      fat: Number(data.fat ?? 0),
      date: (data.date as string) ?? "",
      favorite: Boolean(data.favorite),
      createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    }
  })
}

export async function createMeal(uid: string, input: MealInput): Promise<string> {
  const ref = await addDoc(mealsRef(uid), {
    ...input,
    favorite: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Re-logs a favorite meal on a new date (quick-add), keeping its macros. */
export async function logFavoriteMeal(uid: string, meal: Meal, date: string): Promise<string> {
  return createMeal(uid, {
    name: meal.name,
    type: meal.type,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    date,
  })
}

export async function updateMeal(uid: string, id: string, input: MealInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "nutritionMeals", id), { ...input })
}

export async function setMealFavorite(uid: string, id: string, favorite: boolean): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "nutritionMeals", id), { favorite })
}

export async function deleteMeal(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "nutritionMeals", id))
}

/* --------------------------------- Water --------------------------------- */

export interface WaterDay {
  date: string
  cups: number
}

function waterDayRef(uid: string, date: string) {
  return doc(firestore(), "users", uid, "nutritionWater", date)
}

export async function fetchWaterCups(uid: string, date: string): Promise<number> {
  const snap = await getDoc(waterDayRef(uid, date))
  if (!snap.exists()) return 0
  return Number((snap.data() as Record<string, unknown>).cups ?? 0)
}

export async function setWaterCups(uid: string, date: string, cups: number): Promise<void> {
  await setDoc(waterDayRef(uid, date), { date, cups: Math.max(0, cups) }, { merge: true })
}

/** All logged water-days, most recent first — used for weekly/monthly trend charts. */
export async function fetchWaterHistory(uid: string): Promise<WaterDay[]> {
  const snap = await getDocs(collection(firestore(), "users", uid, "nutritionWater"))
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      return { date: (data.date as string) ?? d.id, cups: Number(data.cups ?? 0) }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

/* --------------------------------- Weight --------------------------------- */

export interface WeightEntry {
  id: string
  date: string
  weightKg: number
  createdAt: number | null
}

export interface WeightInput {
  date: string
  weightKg: number
}

function weightRef(uid: string) {
  return collection(firestore(), "users", uid, "bodyWeight")
}

export async function fetchWeightEntries(uid: string): Promise<WeightEntry[]> {
  const q = query(weightRef(uid), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const createdAt = data.createdAt
    return {
      id: d.id,
      date: (data.date as string) ?? "",
      weightKg: Number(data.weightKg ?? 0),
      createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    }
  })
}

export async function logWeight(uid: string, input: WeightInput): Promise<string> {
  const ref = await addDoc(weightRef(uid), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteWeightEntry(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "bodyWeight", id))
}

/* ------------------------------ Targets/profile ------------------------------ */

export interface NutritionTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
  water: number
}

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2200,
  protein: 140,
  carbs: 250,
  fat: 70,
  water: 8,
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active"

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; multiplier: number }[] = [
  { value: "sedentary", label: "Sedentario (poco o nada de ejercicio)", multiplier: 1.2 },
  { value: "light", label: "Ligero (1-3 días/semana)", multiplier: 1.375 },
  { value: "moderate", label: "Moderado (3-5 días/semana)", multiplier: 1.55 },
  { value: "active", label: "Activo (6-7 días/semana)", multiplier: 1.725 },
  { value: "very_active", label: "Muy activo (entrenamiento intenso a diario)", multiplier: 1.9 },
]

export type NutritionGoal = "lose" | "maintain" | "gain"

export const NUTRITION_GOALS: { value: NutritionGoal; label: string }[] = [
  { value: "lose", label: "Bajar de peso" },
  { value: "maintain", label: "Mantener" },
  { value: "gain", label: "Subir de peso / ganar músculo" },
]

export interface NutritionProfile {
  heightCm: number | null
  sex: "male" | "female" | null
  birthYear: number | null
  activityLevel: ActivityLevel
  weightUnit: WeightUnit
  goal: NutritionGoal
}

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  heightCm: null,
  sex: null,
  birthYear: null,
  activityLevel: "moderate",
  weightUnit: "kg",
  goal: "maintain",
}

export async function fetchNutritionTargets(uid: string): Promise<NutritionTargets> {
  const snap = await getDoc(doc(firestore(), "users", uid))
  const data = snap.data() as Record<string, unknown> | undefined
  const stored = data?.nutritionTargets as Partial<NutritionTargets> | undefined
  return { ...DEFAULT_NUTRITION_TARGETS, ...stored }
}

export async function saveNutritionTargets(uid: string, targets: NutritionTargets): Promise<void> {
  await setDoc(doc(firestore(), "users", uid), { nutritionTargets: targets }, { merge: true })
}

export async function fetchNutritionProfile(uid: string): Promise<NutritionProfile> {
  const snap = await getDoc(doc(firestore(), "users", uid))
  const data = snap.data() as Record<string, unknown> | undefined
  const stored = data?.nutritionProfile as Partial<NutritionProfile> | undefined
  return { ...DEFAULT_NUTRITION_PROFILE, ...stored }
}

export async function saveNutritionProfile(uid: string, profile: NutritionProfile): Promise<void> {
  await setDoc(doc(firestore(), "users", uid), { nutritionProfile: profile }, { merge: true })
}

/** Mifflin-St Jeor equation. */
export function calculateBMR(sex: "male" | "female", weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === "male" ? base + 5 : base - 161)
}

export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  const multiplier = ACTIVITY_LEVELS.find((a) => a.value === activity)?.multiplier ?? 1.55
  return Math.round(bmr * multiplier)
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  if (heightM <= 0) return 0
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

export function bmiCategory(bmi: number): string {
  if (bmi <= 0) return "—"
  if (bmi < 18.5) return "Bajo peso"
  if (bmi < 25) return "Peso saludable"
  if (bmi < 30) return "Sobrepeso"
  return "Obesidad"
}
