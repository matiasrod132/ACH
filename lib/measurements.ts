import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

function firestore() {
  if (!db) throw new Error("Firebase no está configurado")
  return db
}

export interface MeasurementFields {
  chestCm: number | null
  waistCm: number | null
  hipsCm: number | null
  bicepCm: number | null
  thighCm: number | null
  calfCm: number | null
  neckCm: number | null
}

export const MEASUREMENT_FIELDS: { key: keyof MeasurementFields; label: string }[] = [
  { key: "chestCm", label: "Pecho" },
  { key: "waistCm", label: "Cintura" },
  { key: "hipsCm", label: "Cadera" },
  { key: "bicepCm", label: "Bíceps" },
  { key: "thighCm", label: "Muslo" },
  { key: "calfCm", label: "Pantorrilla" },
  { key: "neckCm", label: "Cuello" },
]

export interface MeasurementEntry extends MeasurementFields {
  id: string
  date: string
  createdAt: number | null
}

export type MeasurementInput = MeasurementFields & { date: string }

function measurementsRef(uid: string) {
  return collection(firestore(), "users", uid, "bodyMeasurements")
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export async function fetchMeasurements(uid: string): Promise<MeasurementEntry[]> {
  const q = query(measurementsRef(uid), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const createdAt = data.createdAt
    return {
      id: d.id,
      date: (data.date as string) ?? "",
      chestCm: numOrNull(data.chestCm),
      waistCm: numOrNull(data.waistCm),
      hipsCm: numOrNull(data.hipsCm),
      bicepCm: numOrNull(data.bicepCm),
      thighCm: numOrNull(data.thighCm),
      calfCm: numOrNull(data.calfCm),
      neckCm: numOrNull(data.neckCm),
      createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    }
  })
}

export async function logMeasurement(uid: string, input: MeasurementInput): Promise<string> {
  const ref = await addDoc(measurementsRef(uid), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteMeasurementEntry(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "bodyMeasurements", id))
}
