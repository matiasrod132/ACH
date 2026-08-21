import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import extraExercisesData from "@/lib/data/gym-exercises-extra.json"
import extraInstructionsData from "@/lib/data/gym-instructions-extra.json"

function firestore() {
  if (!db) throw new Error("Firebase no está configurado")
  return db
}

/* ----------------------------- Exercise library ---------------------------- */

export type MuscleGroup =
  | "Pecho"
  | "Espalda"
  | "Piernas"
  | "Hombros"
  | "Brazos"
  | "Core"
  | "Cardio"
  | "Cuerpo completo"

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Brazos",
  "Core",
  "Cardio",
  "Cuerpo completo",
]

export interface ExerciseDef {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: string
  /**
   * ID in the free-exercise-db dataset (github.com/yuhonas/free-exercise-db,
   * MIT license) — used to fetch demo images. Absent when no confident match
   * exists in that dataset (e.g. Burpees, which it doesn't cover).
   */
  datasetId?: string
  /**
   * Path of an illustrated (non-photo) demo GIF in the user's local
   * exercises-dataset pack, verified against github.com/hasaneyldrm/exercises-dataset
   * (relative path like "videos/0025-EIeI8Vf.gif"). That media is © Gym
   * visual, used here per the user's explicit direction for their own
   * personal, non-commercial use — not a free/open license. Preferred over
   * datasetId when present; falls back to the free-exercise-db photo
   * otherwise.
   */
  gymVisualPath?: string
}

const CURATED_EXERCISE_LIBRARY: ExerciseDef[] = [
  // Pecho
  { id: "bench-press", name: "Press de banca", muscleGroup: "Pecho", equipment: "Barra", datasetId: "Barbell_Bench_Press_-_Medium_Grip", gymVisualPath: "videos/0025-EIeI8Vf.gif" },
  { id: "incline-bench-press", name: "Press inclinado", muscleGroup: "Pecho", equipment: "Barra", datasetId: "Barbell_Incline_Bench_Press_-_Medium_Grip", gymVisualPath: "videos/0047-3TZduzM.gif" },
  { id: "dumbbell-press", name: "Press con mancuernas", muscleGroup: "Pecho", equipment: "Mancuernas", datasetId: "Dumbbell_Bench_Press", gymVisualPath: "videos/0289-SpYC0Kp.gif" },
  { id: "push-up", name: "Flexiones", muscleGroup: "Pecho", equipment: "Peso corporal", datasetId: "Pushups", gymVisualPath: "videos/0662-I4hDWkc.gif" },
  { id: "chest-fly", name: "Aperturas", muscleGroup: "Pecho", equipment: "Mancuernas", datasetId: "Dumbbell_Flyes", gymVisualPath: "videos/0308-yz9nUhF.gif" },
  { id: "dips", name: "Fondos", muscleGroup: "Pecho", equipment: "Peso corporal", datasetId: "Dips_-_Chest_Version", gymVisualPath: "videos/0251-9WTm7dq.gif" },
  { id: "cable-crossover", name: "Cruces en polea", muscleGroup: "Pecho", equipment: "Polea", datasetId: "Cable_Crossover", gymVisualPath: "videos/1270-j7XMAyn.gif" },
  { id: "decline-bench-press", name: "Press declinado", muscleGroup: "Pecho", equipment: "Barra", gymVisualPath: "videos/0033-GrO65fd.gif" },
  { id: "pullover", name: "Pullover", muscleGroup: "Pecho", equipment: "Barra", gymVisualPath: "videos/0073-i6LWjok.gif" },
  { id: "chest-press-machine", name: "Press de pecho en máquina", muscleGroup: "Pecho", equipment: "Máquina", gymVisualPath: "videos/0577-T0yTjgW.gif" },
  // Espalda
  { id: "deadlift", name: "Peso muerto", muscleGroup: "Espalda", equipment: "Barra", datasetId: "Barbell_Deadlift", gymVisualPath: "videos/0032-ila4NZS.gif" },
  { id: "pull-up", name: "Dominadas", muscleGroup: "Espalda", equipment: "Peso corporal", datasetId: "Pullups", gymVisualPath: "videos/0652-lBDjFxJ.gif" },
  { id: "lat-pulldown", name: "Jalón al pecho", muscleGroup: "Espalda", equipment: "Polea", datasetId: "Wide-Grip_Lat_Pulldown", gymVisualPath: "videos/2330-LEprlgG.gif" },
  { id: "barbell-row", name: "Remo con barra", muscleGroup: "Espalda", equipment: "Barra", datasetId: "Bent_Over_Barbell_Row", gymVisualPath: "videos/0027-eZyBC3j.gif" },
  { id: "dumbbell-row", name: "Remo con mancuerna", muscleGroup: "Espalda", equipment: "Mancuernas", datasetId: "One-Arm_Dumbbell_Row", gymVisualPath: "videos/0292-C0MA9bC.gif" },
  { id: "seated-cable-row", name: "Remo en polea sentado", muscleGroup: "Espalda", equipment: "Polea", datasetId: "Seated_Cable_Rows", gymVisualPath: "videos/0861-fUBheHs.gif" },
  { id: "hyperextension", name: "Hiperextensiones", muscleGroup: "Espalda", equipment: "Peso corporal", datasetId: "Hyperextensions_Back_Extensions", gymVisualPath: "videos/0489-zhMwOwE.gif" },
  { id: "t-bar-row", name: "Remo en T", muscleGroup: "Espalda", equipment: "Máquina", gymVisualPath: "videos/1349-BgljGjd.gif" },
  { id: "trap-bar-deadlift", name: "Peso muerto con barra trampa", muscleGroup: "Espalda", equipment: "Barra trampa", gymVisualPath: "videos/0811-jQGwmxN.gif" },
  // Piernas
  { id: "squat", name: "Sentadilla", muscleGroup: "Piernas", equipment: "Barra", datasetId: "Barbell_Squat", gymVisualPath: "videos/0043-qXTaZnJ.gif" },
  { id: "leg-press", name: "Prensa de piernas", muscleGroup: "Piernas", equipment: "Máquina", datasetId: "Leg_Press", gymVisualPath: "videos/0739-10Z2DXU.gif" },
  { id: "lunges", name: "Zancadas", muscleGroup: "Piernas", equipment: "Mancuernas", datasetId: "Dumbbell_Lunges", gymVisualPath: "videos/0336-RRWFUcw.gif" },
  { id: "leg-extension", name: "Extensión de cuádriceps", muscleGroup: "Piernas", equipment: "Máquina", datasetId: "Leg_Extensions", gymVisualPath: "videos/0585-my33uHU.gif" },
  { id: "leg-curl", name: "Curl femoral", muscleGroup: "Piernas", equipment: "Máquina", datasetId: "Lying_Leg_Curls", gymVisualPath: "videos/0586-17lJ1kr.gif" },
  { id: "calf-raise", name: "Elevación de talones", muscleGroup: "Piernas", equipment: "Máquina", datasetId: "Standing_Calf_Raises", gymVisualPath: "videos/0605-ykUOVze.gif" },
  { id: "romanian-deadlift", name: "Peso muerto rumano", muscleGroup: "Piernas", equipment: "Barra", datasetId: "Romanian_Deadlift", gymVisualPath: "videos/0085-wQ2c4XD.gif" },
  { id: "hip-thrust", name: "Hip thrust", muscleGroup: "Piernas", equipment: "Barra", datasetId: "Barbell_Hip_Thrust", gymVisualPath: "videos/3236-Pjbc0Kt.gif" },
  { id: "bulgarian-split-squat", name: "Sentadilla búlgara", muscleGroup: "Piernas", equipment: "Mancuernas", datasetId: "Split_Squat_with_Dumbbells", gymVisualPath: "videos/0099-gGNQmVt.gif" },
  { id: "sumo-deadlift", name: "Peso muerto sumo", muscleGroup: "Piernas", equipment: "Barra", gymVisualPath: "videos/0117-KgI0tqW.gif" },
  { id: "good-morning", name: "Buenos días", muscleGroup: "Piernas", equipment: "Barra", gymVisualPath: "videos/0044-XlZ4lAC.gif" },
  { id: "front-squat", name: "Sentadilla frontal", muscleGroup: "Piernas", equipment: "Barra", gymVisualPath: "videos/0042-zG0zs85.gif" },
  { id: "goblet-squat", name: "Sentadilla goblet", muscleGroup: "Piernas", equipment: "Mancuernas", gymVisualPath: "videos/1760-yn8yg1r.gif" },
  { id: "step-up", name: "Step up", muscleGroup: "Piernas", equipment: "Mancuernas", gymVisualPath: "videos/0431-aXtJhlg.gif" },
  { id: "pistol-squat", name: "Sentadilla pistol", muscleGroup: "Piernas", equipment: "Kettlebell", gymVisualPath: "videos/0544-5bpPTHv.gif" },
  { id: "glute-bridge", name: "Puente de glúteo", muscleGroup: "Piernas", equipment: "Barra", gymVisualPath: "videos/1409-qKBpF7I.gif" },
  { id: "hack-squat", name: "Sentadilla hack", muscleGroup: "Piernas", equipment: "Barra", gymVisualPath: "videos/0046-5VCj6iH.gif" },
  { id: "walking-lunge", name: "Zancada caminando", muscleGroup: "Piernas", equipment: "Peso corporal", gymVisualPath: "videos/1460-IZVHb27.gif" },
  { id: "seated-calf-raise", name: "Elevación de talones sentado", muscleGroup: "Piernas", equipment: "Máquina", gymVisualPath: "videos/0594-bOOdeyc.gif" },
  { id: "hip-abduction", name: "Abducción de cadera", muscleGroup: "Piernas", equipment: "Máquina", gymVisualPath: "videos/0597-CHpahtl.gif" },
  { id: "hip-adduction", name: "Aducción de cadera", muscleGroup: "Piernas", equipment: "Máquina", gymVisualPath: "videos/0598-oHsrypV.gif" },
  { id: "cable-pull-through", name: "Peso muerto en polea (pull through)", muscleGroup: "Piernas", equipment: "Polea", gymVisualPath: "videos/0196-OM46QHm.gif" },
  // Hombros
  { id: "overhead-press", name: "Press militar", muscleGroup: "Hombros", equipment: "Barra", datasetId: "Standing_Military_Press", gymVisualPath: "videos/1457-Kyd9Rz5.gif" },
  { id: "dumbbell-shoulder-press", name: "Press de hombro con mancuernas", muscleGroup: "Hombros", equipment: "Mancuernas", datasetId: "Dumbbell_Shoulder_Press", gymVisualPath: "videos/0405-znQUdHY.gif" },
  { id: "lateral-raise", name: "Elevaciones laterales", muscleGroup: "Hombros", equipment: "Mancuernas", datasetId: "Side_Lateral_Raise", gymVisualPath: "videos/0334-DsgkuIt.gif" },
  { id: "front-raise", name: "Elevaciones frontales", muscleGroup: "Hombros", equipment: "Mancuernas", datasetId: "Front_Dumbbell_Raise", gymVisualPath: "videos/0310-3eGE2JC.gif" },
  { id: "rear-delt-fly", name: "Aperturas posteriores", muscleGroup: "Hombros", equipment: "Mancuernas", datasetId: "Reverse_Flyes", gymVisualPath: "videos/0383-EAs3xL9.gif" },
  { id: "shrugs", name: "Encogimientos", muscleGroup: "Hombros", equipment: "Mancuernas", datasetId: "Barbell_Shrug", gymVisualPath: "videos/0095-dG7tG5y.gif" },
  { id: "face-pull", name: "Face pull", muscleGroup: "Hombros", equipment: "Polea", datasetId: "Face_Pull", gymVisualPath: "videos/0233-ZfyAGhK.gif" },
  { id: "arnold-press", name: "Press Arnold", muscleGroup: "Hombros", equipment: "Mancuernas", gymVisualPath: "videos/2137-Xy4jlWA.gif" },
  { id: "upright-row", name: "Remo al mentón", muscleGroup: "Hombros", equipment: "Barra", gymVisualPath: "videos/0120-UDlhcO8.gif" },
  // Brazos
  { id: "barbell-curl", name: "Curl de bíceps con barra", muscleGroup: "Brazos", equipment: "Barra", datasetId: "Barbell_Curl", gymVisualPath: "videos/0031-25GPyDY.gif" },
  { id: "dumbbell-curl", name: "Curl de bíceps con mancuernas", muscleGroup: "Brazos", equipment: "Mancuernas", datasetId: "Dumbbell_Bicep_Curl", gymVisualPath: "videos/0294-NbVPDMW.gif" },
  { id: "hammer-curl", name: "Curl martillo", muscleGroup: "Brazos", equipment: "Mancuernas", datasetId: "Hammer_Curls", gymVisualPath: "videos/0313-slDvUAU.gif" },
  { id: "tricep-pushdown", name: "Extensión de tríceps en polea", muscleGroup: "Brazos", equipment: "Polea", datasetId: "Triceps_Pushdown", gymVisualPath: "videos/0201-3ZflifB.gif" },
  { id: "skull-crusher", name: "Press francés", muscleGroup: "Brazos", equipment: "Barra", datasetId: "Decline_Close-Grip_Bench_To_Skull_Crusher", gymVisualPath: "videos/0060-h8LFzo9.gif" },
  { id: "close-grip-bench", name: "Press cerrado", muscleGroup: "Brazos", equipment: "Barra", datasetId: "Close-Grip_Barbell_Bench_Press", gymVisualPath: "videos/0030-J6Dx1Mu.gif" },
  { id: "tricep-dip", name: "Fondos de tríceps", muscleGroup: "Brazos", equipment: "Peso corporal", datasetId: "Bench_Dips", gymVisualPath: "videos/0814-X6C6i5Y.gif" },
  { id: "preacher-curl", name: "Curl predicador", muscleGroup: "Brazos", equipment: "Barra", gymVisualPath: "videos/0070-qOgPVf6.gif" },
  { id: "concentration-curl", name: "Curl concentrado", muscleGroup: "Brazos", equipment: "Mancuernas", gymVisualPath: "videos/0297-gvsWLQw.gif" },
  { id: "cable-curl", name: "Curl en polea", muscleGroup: "Brazos", equipment: "Polea", gymVisualPath: "videos/0868-G08RZcQ.gif" },
  { id: "tricep-kickback", name: "Patada de tríceps", muscleGroup: "Brazos", equipment: "Mancuernas", gymVisualPath: "videos/1739-Gi2BXfK.gif" },
  // Core
  { id: "plank", name: "Plancha", muscleGroup: "Core", equipment: "Peso corporal", datasetId: "Plank" },
  { id: "crunch", name: "Abdominales", muscleGroup: "Core", equipment: "Peso corporal", datasetId: "Crunches", gymVisualPath: "videos/0274-TFqbd8t.gif" },
  { id: "hanging-leg-raise", name: "Elevación de piernas colgado", muscleGroup: "Core", equipment: "Peso corporal", datasetId: "Hanging_Leg_Raise", gymVisualPath: "videos/0472-I3tsCnC.gif" },
  { id: "russian-twist", name: "Giros rusos", muscleGroup: "Core", equipment: "Peso corporal", datasetId: "Russian_Twist", gymVisualPath: "videos/0687-XVDdcoj.gif" },
  { id: "cable-crunch", name: "Crunch en polea", muscleGroup: "Core", equipment: "Polea", datasetId: "Cable_Crunch", gymVisualPath: "videos/0212-8xUv4J7.gif" },
  { id: "ab-wheel", name: "Rueda abdominal", muscleGroup: "Core", equipment: "Rueda", datasetId: "Ab_Roller", gymVisualPath: "videos/0103-xnInPfE.gif" },
  { id: "mountain-climber", name: "Escaladores", muscleGroup: "Core", equipment: "Peso corporal", gymVisualPath: "videos/0630-RJgzwny.gif" },
  { id: "dead-bug", name: "Dead bug", muscleGroup: "Core", equipment: "Peso corporal", gymVisualPath: "videos/0276-iny3m5y.gif" },
  { id: "sit-up", name: "Abdominal completo", muscleGroup: "Core", equipment: "Peso corporal", gymVisualPath: "videos/0456-AR0ig3o.gif" },
  { id: "lying-leg-raise", name: "Elevación de piernas tumbado", muscleGroup: "Core", equipment: "Peso corporal", gymVisualPath: "videos/0620-WhuFnR7.gif" },
  { id: "reverse-crunch", name: "Crunch inverso", muscleGroup: "Core", equipment: "Peso corporal", gymVisualPath: "videos/0872-nCU1Ekp.gif" },
  { id: "side-bend", name: "Elevación lateral de tronco", muscleGroup: "Core", equipment: "Mancuernas", gymVisualPath: "videos/0407-IpONWYv.gif" },
  { id: "pallof-press", name: "Press Pallof", muscleGroup: "Core", equipment: "Banda", gymVisualPath: "videos/0979-9pa4H5m.gif" },
  // Cardio
  { id: "running", name: "Correr", muscleGroup: "Cardio", equipment: "Ninguno", datasetId: "Trail_Running_Walking", gymVisualPath: "videos/3666-rjiM4L3.gif" },
  { id: "cycling", name: "Bicicleta", muscleGroup: "Cardio", equipment: "Ninguno", datasetId: "Bicycling", gymVisualPath: "videos/2138-H1PESYI.gif" },
  { id: "rowing", name: "Remo (máquina)", muscleGroup: "Cardio", equipment: "Máquina", datasetId: "Rowing_Stationary" },
  { id: "jump-rope", name: "Cuerda", muscleGroup: "Cardio", equipment: "Ninguno", datasetId: "Rope_Jumping", gymVisualPath: "videos/2612-e1e76I2.gif" },
  { id: "elliptical", name: "Elíptica", muscleGroup: "Cardio", equipment: "Máquina", datasetId: "Elliptical_Trainer", gymVisualPath: "videos/2141-rjtuP6X.gif" },
  { id: "stair-climber", name: "Escaladora", muscleGroup: "Cardio", equipment: "Máquina", datasetId: "Step_Mill" },
  // Cuerpo completo
  { id: "burpee", name: "Burpees", muscleGroup: "Cuerpo completo", equipment: "Peso corporal", gymVisualPath: "videos/1160-dK9394r.gif" },
  { id: "clean-and-jerk", name: "Clean and jerk", muscleGroup: "Cuerpo completo", equipment: "Barra", datasetId: "Clean_and_Jerk", gymVisualPath: "videos/0537-vzAxBtt.gif" },
  { id: "kettlebell-swing", name: "Swing con kettlebell", muscleGroup: "Cuerpo completo", equipment: "Kettlebell", datasetId: "One-Arm_Kettlebell_Swings", gymVisualPath: "videos/0549-UHJlbu3.gif" },
  { id: "thruster", name: "Thruster", muscleGroup: "Cuerpo completo", equipment: "Barra", datasetId: "Kettlebell_Thruster", gymVisualPath: "videos/3305-f7Y9eDZ.gif" },
  { id: "snatch", name: "Snatch (arrancada)", muscleGroup: "Cuerpo completo", equipment: "Barra", datasetId: "Snatch", gymVisualPath: "videos/0067-xHKN2s8.gif" },
  { id: "farmers-walk", name: "Paseo del granjero", muscleGroup: "Cuerpo completo", equipment: "Mancuernas", gymVisualPath: "videos/2133-qPEzJjA.gif" },
]

/**
 * Catálogo ampliado (github.com/hasaneyldrm/exercises-dataset), generado a partir
 * del dataset completo excluyendo cardio de máquina (caminadora, elíptica, bici
 * estática, etc. — esos ya están cubiertos arriba). Los nombres en español se
 * generaron con un traductor por reglas: la mayoría queda natural, pero algunas
 * variantes poco comunes (sobre todo estiramientos) pueden leerse con alguna
 * palabra suelta en inglés. Vive en JSON en vez de como literal TS para que el
 * bundler no tenga que parsear/transformar miles de nodos AST en cada build.
 */
export const EXERCISE_LIBRARY: ExerciseDef[] = [
  ...CURATED_EXERCISE_LIBRARY,
  ...(extraExercisesData as ExerciseDef[]),
]

// Imágenes de demostración (github.com/yuhonas/free-exercise-db, MIT) servidas
// vía CDN de jsDelivr — no requiere API key ni cuenta.
const EXERCISE_IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises"

/** frame 0 = posición inicial, frame 1 = posición final del movimiento. */
export function exerciseImageUrl(datasetId: string, frame: 0 | 1 = 0): string {
  return `${EXERCISE_IMAGE_BASE}/${datasetId}/${frame}.jpg`
}

// GIFs ilustrados (github.com/hasaneyldrm/exercises-dataset) servidos vía CDN
// de jsDelivr. El código/metadata del dataset es MIT, pero los GIFs son ©
// Gym Visual — se usan aquí solo por autorización explícita del usuario para
// su app personal, no comercial.
const GYM_VISUAL_BASE = "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main"

export function gymVisualImageUrl(path: string): string {
  return `${GYM_VISUAL_BASE}/${path}`
}

export function findExerciseByName(name: string): ExerciseDef | undefined {
  return EXERCISE_LIBRARY.find((e) => e.name === name)
}

/**
 * Spanish step-by-step instructions, sourced from the TEXT/data portion of
 * github.com/hasaneyldrm/exercises-dataset (MIT licensed). That repo's media
 * (images/videos) is separately © Gym visual, redistributed there under a
 * one-off written permission that explicitly does NOT extend to downstream
 * reuse — so only the plain-text instructions were taken, never the media.
 * Only includes exercises where the matched entry's movement pattern and
 * equipment genuinely match ours (a few close-but-not-quite matches, like a
 * single-leg alternating "leg press" variant, were deliberately left out).
 */
const CURATED_EXERCISE_INSTRUCTIONS_ES: Record<string, string[]> = {
  "bench-press": ["Túmbate sobre un banco con los pies apoyados en el suelo y la espalda presionada contra el banco.","Agarra la barra con un agarre pronado un poco más ancho que la separación de los hombros.","Levanta la barra del soporte y sostenla directamente sobre el pecho con los brazos completamente extendidos.","Baja la barra lentamente hacia el pecho, manteniendo los codos pegados al cuerpo.","Haz una pausa breve cuando la barra toque el pecho.","Empuja la barra de vuelta a la posición inicial extendiendo los brazos.","Repite el número de repeticiones deseado."],
  "incline-bench-press": ["Coloca un banco inclinado a un ángulo de 45 grados.","Túmbate en el banco con los pies planos sobre el suelo.","Agarra la barra con un agarre pronado un poco más ancho que la separación de los hombros.","Saca la barra del soporte y bájala lentamente hacia el pecho, manteniendo los codos a un ángulo de 45 grados.","Haz una pausa breve en la parte baja y luego empuja la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "dumbbell-press": ["Túmbate sobre un banco con los pies apoyados en el suelo y la espalda presionada contra el banco.","Sujeta una mancuerna en cada mano, con las palmas hacia adelante y los brazos extendidos por encima del pecho.","Baja lentamente las mancuernas hacia los lados del pecho, manteniendo los codos en un ángulo de 90 grados.","Haz una pausa breve, luego empuja las mancuernas de vuelta hacia arriba hasta la posición inicial, extendiendo completamente los brazos.","Repite el número de repeticiones deseado."],
  "push-up": ["Comienza en una posición de plancha alta con las manos un poco más separadas que la anchura de los hombros y los pies juntos.","Activa el core y baja el cuerpo hacia el suelo flexionando los codos, manteniendo el cuerpo en línea recta.","Haz una pausa cuando el pecho esté justo por encima del suelo y luego empújate de vuelta a la posición inicial estirando los brazos.","Repite el número de repeticiones deseado."],
  "dips": ["Colócate en las barras paralelas con los brazos completamente extendidos y el cuerpo recto.","Baja el cuerpo flexionando los codos hasta que los hombros queden por debajo de los codos.","Empújate de vuelta hacia arriba a la posición inicial extendiendo los brazos.","Repite el número de repeticiones deseado."],
  "cable-crossover": ["Ponte de pie en el medio de una máquina de cable con los pies separados a la altura de los hombros.","Sujeta los mangos de los cables con las palmas hacia abajo y los brazos extendidos hacia los lados.","Manteniendo los brazos rectos, junta las manos frente a tu cuerpo, cruzándolas una sobre la otra.","Haz una pausa breve, luego regresa lentamente a la posición inicial, manteniendo los brazos extendidos.","Repite el número de repeticiones deseado."],
  "deadlift": ["Ponte de pie con los pies separados a la altura de los hombros y la barra en el suelo frente a ti.","Flexiona las rodillas y las caderas para bajar el torso y agarra la barra con un agarre pronado, con las manos un poco más separadas que el ancho de los hombros.","Mantén la espalda recta y el pecho elevado mientras empujas con los talones para levantar la barra del suelo, extendiendo las caderas y las rodillas.","Al ponerte de pie, aprieta los glúteos y mantén el core activado.","Baja la barra de vuelta al suelo flexionando las caderas y las rodillas, manteniendo la espalda recta.","Repite el número de repeticiones deseado."],
  "pull-up": ["Cuélgate de una barra de dominadas con las palmas hacia afuera y los brazos completamente extendidos.","Activa el core y junta los omóplatos.","Tira de tu cuerpo hacia la barra flexionando los codos y llevando el pecho hacia la barra.","Haz una pausa en la parte alta del movimiento y luego baja lentamente el cuerpo de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "lat-pulldown": ["Siéntate en la máquina de jalón al pecho con las rodillas colocadas debajo de las almohadillas.","Sujeta la barra del cable con un agarre prono, un poco más separado que el ancho de los hombros.","Inclínate ligeramente hacia atrás y mantén el pecho elevado, conservando un ligero arco en la zona lumbar.","Jala la barra hacia la parte superior del pecho, apretando los omóplatos entre sí.","Haz una pausa por un momento en la parte baja del movimiento y luego suelta lentamente la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "barbell-row": ["Ponte de pie con los pies separados a la altura de los hombros y las rodillas ligeramente flexionadas.","Inclínate hacia delante desde las caderas manteniendo la espalda recta y el pecho elevado.","Agarra la barra con un agarre pronado, con las manos un poco más separadas que el ancho de los hombros.","Tira de la barra hacia la parte inferior del pecho retrayendo los omóplatos y contrayendo los músculos de la espalda.","Haz una pausa breve en la parte alta y luego baja lentamente la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "dumbbell-row": ["Ponte de pie con los pies separados a la altura de los hombros, sosteniendo una mancuerna en una mano con la palma hacia el cuerpo.","Flexiona ligeramente las rodillas e inclínate hacia adelante desde las caderas, manteniendo la espalda recta y el core activado.","Deja que la mancuerna cuelgue recta hacia el suelo, con el brazo completamente extendido.","Tira de la mancuerna hacia el pecho, manteniendo el codo cerca del cuerpo y juntando los omóplatos.","Haz una pausa breve en la parte más alta, luego baja lentamente la mancuerna de vuelta a la posición inicial.","Repite el número de repeticiones deseado, luego cambia de lado."],
  "seated-cable-row": ["Siéntate en la máquina de remo con cable con los pies planos sobre los apoyapiés y las rodillas ligeramente flexionadas.","Sujeta las agarraderas con un agarre prono, manteniendo la espalda recta y los hombros relajados.","Jala las agarraderas hacia el cuerpo, apretando los omóplatos entre sí.","Haz una pausa por un momento en el punto máximo del movimiento, luego suelta lentamente las agarraderas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "hyperextension": ["Ajusta el banco de hiperextensiones para que la parte superior de los muslos quede apoyada en la almohadilla y los pies queden asegurados.","Cruza los brazos sobre el pecho o coloca las manos detrás de la cabeza.","Baja la parte superior del cuerpo hacia el suelo manteniendo la espalda recta.","Haz una pausa breve en la parte baja, luego eleva la parte superior del cuerpo hasta que quede alineada con las piernas.","Repite el número de repeticiones deseado."],
  "squat": ["Ponte de pie con los pies separados a la altura de los hombros, con los dedos de los pies ligeramente hacia afuera.","Sujeta la barra sobre la parte superior de la espalda, apoyándola en los trapecios o los deltoides posteriores.","Activa el core y mantén el pecho elevado mientras comienzas a bajar el cuerpo.","Flexiona las rodillas y las caderas, empujando las caderas hacia atrás y hacia abajo como si te sentaras en una silla.","Baja hasta que los muslos queden paralelos al suelo o un poco por debajo.","Mantén las rodillas alineadas con los dedos de los pies y el peso sobre los talones.","Empuja con los talones para volver a ponerte de pie, extendiendo las caderas y las rodillas.","Repite el número de repeticiones deseado."],
  "lunges": ["Ponte de pie con los pies separados a la altura de los hombros, sujetando una mancuerna en cada mano.","Da un paso adelante con el pie derecho, bajando el cuerpo hasta una posición de zancada.","Mantén la espalda recta y el pecho erguido mientras bajas el cuerpo.","Empuja con el talón derecho para regresar a la posición inicial.","Repite con la pierna izquierda.","Alterna las piernas el número de repeticiones deseado."],
  "leg-extension": ["Ajusta la altura del asiento y el respaldo de la máquina a tu cuerpo.","Siéntate en la máquina con la espalda apoyada en el respaldo y los pies sobre la almohadilla para los pies.","Sujeta las asas o las barras laterales para mayor estabilidad.","Extiende las piernas hacia adelante enderezando las rodillas, levantando el peso.","Haz una pausa breve en lo alto, luego baja lentamente el peso de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "leg-curl": ["Ajusta la máquina a tu cuerpo y selecciona el peso deseado.","Túmbate boca abajo en la máquina con las piernas rectas y los talones contra la palanca acolchada.","Sujeta las asas o los lados de la máquina para mayor estabilidad.","Manteniendo la parte superior del cuerpo inmóvil, exhala y flexiona las piernas hacia arriba tanto como sea posible sin levantar las caderas de la almohadilla.","Mantén la posición contraída durante una pausa breve mientras aprietas los isquiotibiales.","Inhala y baja lentamente la palanca de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "romanian-deadlift": ["Ponte de pie con los pies separados a la altura de los hombros y los dedos de los pies apuntando hacia delante.","Sujeta la barra con un agarre pronado, manos un poco más separadas que el ancho de los hombros.","Flexiona las caderas, manteniendo la espalda recta y las rodillas ligeramente flexionadas.","Baja la barra hacia el suelo, manteniéndola cerca del cuerpo.","Siente el estiramiento en los isquiotibiales mientras bajas la barra.","Cuando sientas el estiramiento en los isquiotibiales, empuja las caderas hacia delante y ponte de pie.","Aprieta los glúteos en la parte alta del movimiento.","Baja la barra de vuelta a la posición inicial y repite el número de repeticiones deseado."],
  "shrugs": ["Ponte de pie con los pies separados a la altura de los hombros y sujeta una barra frente a ti con un agarre pronado.","Mantén los brazos rectos y la espalda recta durante todo el ejercicio.","Levanta los hombros hacia las orejas lo más alto posible, apretando los trapecios en la parte alta.","Mantén la posición por un momento y luego baja lentamente los hombros de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "barbell-curl": ["Ponte de pie con los pies separados a la altura de los hombros y sujeta una barra con un agarre supino, con las palmas mirando hacia delante.","Mantén los codos cerca del torso y exhala mientras levantas el peso contrayendo los bíceps.","Continúa levantando la barra hasta que los bíceps estén completamente contraídos y la barra esté a la altura de los hombros.","Mantén la posición contraída durante una breve pausa mientras aprietas los bíceps.","Inhala mientras comienzas a bajar lentamente la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "dumbbell-curl": ["Ponte de pie con una mancuerna en cada mano, con las palmas hacia adelante y los brazos completamente extendidos.","Manteniendo los brazos superiores fijos, exhala y levanta el peso mientras contraes los bíceps.","Continúa levantando las pesas hasta que los bíceps estén completamente contraídos y las mancuernas estén a la altura de los hombros.","Mantén la posición contraída durante una breve pausa mientras aprietas los bíceps.","Inhala y comienza a bajar lentamente las mancuernas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "hammer-curl": ["Ponte de pie con una mancuerna en cada mano, con las palmas mirando hacia el torso.","Mantén los codos cerca del torso y gira las palmas de las manos hasta que queden mirando hacia adelante.","Esta será tu posición inicial.","Ahora, manteniendo los brazos superiores quietos, exhala y flexiona los brazos contrayendo los bíceps.","Continúa levantando las pesas hasta que los bíceps estén completamente contraídos y las mancuernas estén a la altura de los hombros.","Mantén la posición contraída durante una breve pausa mientras aprietas los bíceps.","Luego, inhala y comienza a bajar lentamente las mancuernas de vuelta a la posición inicial.","Repite el número de repeticiones recomendado."],
  "tricep-pushdown": ["Coloca un accesorio en V en la máquina de cable en el ajuste más alto.","Ponte de pie frente a la máquina de cable con los pies separados a la altura de los hombros.","Agarra el accesorio en V con un agarre prono, con las palmas hacia abajo y las manos separadas a la altura de los hombros.","Mantén los codos cerca de los costados y los brazos superiores quietos durante todo el ejercicio.","Activa los tríceps y exhala mientras empujas el accesorio en V hacia abajo hasta que los brazos estén completamente extendidos.","Haz una pausa breve en la parte baja del movimiento, apretando los tríceps.","Inhala mientras regresas lentamente el accesorio en V a la posición inicial, manteniendo el control.","Repite el número de repeticiones deseado."],
  "skull-crusher": ["Túmbate boca arriba en un banco con los pies planos sobre el suelo y la cabeza en el extremo del banco.","Sujeta una barra con un agarre pronado, manos separadas a la altura de los hombros, y extiende los brazos rectos por encima del pecho.","Manteniendo los brazos superiores fijos, baja lentamente la barra hacia la frente flexionando los codos.","Haz una pausa breve en la parte baja y luego extiende los brazos de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "close-grip-bench": ["Túmbate sobre un banco con los pies apoyados en el suelo y la espalda presionada contra el banco.","Agarra la barra con un agarre cerrado, un poco más estrecho que el ancho de los hombros.","Saca la barra del soporte y bájala lentamente hacia el pecho, manteniendo los codos cerca del cuerpo.","Haz una pausa breve cuando la barra toque el pecho.","Empuja la barra de vuelta a la posición inicial, extendiendo completamente los brazos.","Repite el número de repeticiones deseado."],
  "tricep-dip": ["Siéntate en el borde de un banco o silla con las manos sujetando el borde junto a las caderas.","Desliza los glúteos fuera del banco y estira las piernas frente a ti, manteniendo los talones en el suelo.","Flexiona los codos y baja el cuerpo hacia el suelo, manteniendo la espalda cerca del banco.","Haz una pausa por un momento en la parte inferior, luego empuja tu cuerpo de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "hanging-leg-raise": ["Cuélgate de una barra de dominadas con los brazos completamente extendidos y las palmas mirando hacia afuera.","Activa el core y levanta las piernas frente a ti, manteniéndolas rectas.","Continúa levantando hasta que las piernas estén paralelas al suelo o tan alto como puedas llegar cómodamente.","Haz una pausa por un momento en la parte superior, luego baja lentamente las piernas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "russian-twist": ["Siéntate en el suelo con las rodillas flexionadas y los pies apoyados en el suelo.","Inclínate ligeramente hacia atrás manteniendo la espalda recta y el core activado.","Junta las manos frente al pecho o sujeta una pesa si lo deseas.","Levanta los pies del suelo, equilibrándote sobre los isquiones.","Gira el torso hacia la derecha, llevando las manos o la pesa hacia el lado derecho del cuerpo.","Haz una pausa por un momento, luego gira el torso hacia la izquierda, llevando las manos o la pesa hacia el lado izquierdo del cuerpo.","Continúa alternando lados durante el número de repeticiones deseado."],
  "cable-crunch": ["Siéntate en una máquina de cable con los pies apoyados planos en el suelo y las rodillas flexionadas.","Sujeta la agarradera del cable con ambas manos y colócala detrás de la cabeza.","Activa el abdomen y curva lentamente la parte superior del cuerpo hacia adelante, llevando el pecho hacia las rodillas.","Haz una pausa por un momento en la parte alta y luego regresa lentamente a la posición inicial.","Repite el número de repeticiones deseado."],
  "jump-rope": ["Sujeta las asas de la cuerda de saltar con las manos, palmas hacia adentro.","Ponte de pie con los pies separados a la altura de los hombros y las rodillas ligeramente flexionadas.","Balancea la cuerda por encima de la cabeza y salta sobre ella cuando se acerque a los pies.","Aterriza suavemente sobre la punta de los pies y repite el salto cuando la cuerda vuelva a pasar.","Continúa saltando durante el tiempo o el número de repeticiones deseado."],
  "elliptical": ["Ajusta el nivel de resistencia y la inclinación de la máquina elíptica a los valores deseados.","Sube a los pedales de la máquina y agarra las asas con suavidad.","Comienza empujando hacia abajo con los pies y tirando de las asas hacia tu cuerpo.","Continúa con este movimiento, alternando entre empujar y tirar, para simular un movimiento de caminar o correr.","Mantén un ritmo constante y conserva el core activado durante todo el ejercicio.","Continúa durante la duración deseada de tu entrenamiento cardiovascular.","Disminuye gradualmente la intensidad y la velocidad de la máquina antes de bajarte."],
  "stair-climber": ["Ajusta la máquina de escalones a un nivel cómodo.","Sube a la máquina y coloca las manos sobre los pasamanos para apoyarte.","Comienza a caminar colocando un pie en un escalón y luego el otro, alternando entre las piernas.","Mantén una postura erguida y activa los músculos del core.","Continúa caminando durante la duración o distancia deseada.","Aumenta gradualmente la intensidad o la velocidad a medida que te sientas más cómodo con el ejercicio.","Recuerda enfriar y estirar después de completar el ejercicio."],
  "burpee": ["Comienza de pie con los pies separados a la altura de los hombros.","Baja el cuerpo hacia una posición de sentadilla flexionando las rodillas y colocando las manos en el suelo frente a ti.","Lleva los pies hacia atrás de una patada hasta una posición de flexión de brazos.","Realiza una flexión de brazos, manteniendo el cuerpo en línea recta.","Salta con los pies de vuelta a la posición de sentadilla.","Salta hacia arriba explosivamente, llevando los brazos por encima de la cabeza.","Aterriza suavemente y baja de inmediato a una posición de sentadilla para comenzar la siguiente repetición."],
  "kettlebell-swing": ["Ponte de pie con los pies separados a la altura de los hombros, con los dedos de los pies ligeramente hacia afuera.","Sujeta la pesa rusa con ambas manos frente al cuerpo, con los brazos extendidos.","Flexiona ligeramente las rodillas e inclínate desde las caderas, empujando los glúteos hacia atrás.","Lleva la pesa rusa hacia atrás entre las piernas, manteniendo los brazos rectos y la espalda plana.","Lleva las caderas hacia adelante y haz que la pesa rusa suba hasta la altura del hombro, usando el impulso generado por las caderas.","Deja que la pesa rusa se balancee de vuelta hacia abajo entre las piernas y repite el movimiento el número de repeticiones deseado."],
  "thruster": ["Comienza de pie con los pies separados a la altura de los hombros, sujetando una pesa rusa frente al pecho con ambas manos, con las palmas una frente a la otra.","Baja a una posición de sentadilla flexionando las rodillas y empujando las caderas hacia atrás, manteniendo el pecho elevado y la espalda recta.","Al llegar a la parte baja de la sentadilla, empuja explosivamente con los talones para ponerte de pie, presionando al mismo tiempo la pesa rusa por encima de la cabeza.","Bloquea los brazos en la parte alta del movimiento, extendiendo los codos por completo.","Baja la pesa rusa de vuelta a la posición inicial invirtiendo el movimiento, flexionando los codos y bajando el peso de vuelta al pecho.","Repite el número de repeticiones deseado."],
  "decline-bench-press": ["Túmbate en un banco declinado con los pies sujetos y la cabeza más baja que las caderas.","Agarra la barra con un agarre pronado un poco más ancho que la separación de los hombros.","Saca la barra del soporte y bájala lentamente hacia el pecho, manteniendo los codos pegados al cuerpo.","Haz una pausa breve en la parte baja y luego empuja la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "pullover": ["Túmbate boca arriba en un banco con la cabeza en un extremo y los pies en el suelo.","Sujeta una barra con un agarre a la altura de los hombros y extiende los brazos rectos por encima del pecho.","Manteniendo los brazos rectos, baja la barra detrás de la cabeza de forma controlada hasta sentir un estiramiento en los dorsales.","Haz una pausa breve y luego levanta la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "t-bar-row": ["Ajusta la altura del asiento y la posición de la placa para los pies en la máquina.","Siéntate en la máquina con el pecho contra la almohadilla y los pies planos sobre la placa para los pies.","Agarra las agarraderas con un agarre prono, un poco más separadas que el ancho de los hombros.","Mantén la espalda recta y activa el core.","Tira de las asas hacia el pecho, juntando los omóplatos.","Haz una pausa breve en la parte alta del movimiento, luego suelta lentamente y extiende los brazos de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "sumo-deadlift": ["Ponte de pie con los pies más separados que el ancho de los hombros, con las puntas de los pies hacia afuera.","Coloca una barra en el suelo frente a ti, centrada entre los pies.","Flexiona las rodillas y baja las caderas, manteniendo la espalda recta y el pecho elevado, para sujetar la barra con agarre prono.","Activa el core y empuja con los talones para levantar la barra del suelo, extendiendo las caderas y las rodillas simultáneamente.","Al levantar, mantén el pecho elevado y la espalda recta, y empuja las caderas hacia adelante para activar completamente los glúteos.","Haz una pausa breve en la parte más alta, luego baja lentamente la barra de vuelta a la posición inicial, manteniendo el control durante todo el movimiento.","Repite el número de repeticiones deseado."],
  "good-morning": ["Empieza de pie con los pies separados a la altura de los hombros y la barra apoyada sobre la parte superior de la espalda.","Manteniendo la espalda recta y el core activado, flexiona las caderas hacia delante, empujando los glúteos hacia atrás como si intentaras tocar la pared detrás de ti con ellos.","Baja el torso hasta que quede paralelo al suelo, sintiendo un estiramiento en los isquiotibiales.","Haz una pausa breve y luego vuelve a la posición inicial apretando los glúteos y empujando las caderas hacia delante.","Repite el número de repeticiones deseado."],
  "front-squat": ["Empieza de pie con los pies separados a la altura de los hombros, con los dedos de los pies ligeramente hacia afuera.","Sujeta la barra frente a los hombros, apoyándola sobre la clavícula y los hombros.","Activa el core y mantén el pecho elevado mientras bajas el cuerpo hacia una posición de sentadilla, empujando las caderas hacia atrás y flexionando las rodillas.","Baja hasta que los muslos queden paralelos al suelo, o tan abajo como puedas hacerlo cómodamente.","Haz una pausa por un momento en la parte inferior, luego empuja con los talones para regresar a la posición inicial.","Repite el número de repeticiones deseado."],
  "goblet-squat": ["Ponte de pie con los pies separados a la altura de los hombros, sosteniendo una mancuerna verticalmente contra el pecho con ambas manos.","Manteniendo el pecho erguido y el core activado, baja el cuerpo a una posición de sentadilla empujando las caderas hacia atrás y flexionando las rodillas.","Continúa bajando hasta que los muslos queden paralelos al suelo, o tan abajo como puedas hacerlo cómodamente.","Haz una pausa por un momento en la parte inferior, luego empuja con los talones para regresar a la posición inicial.","Repite el número de repeticiones deseado."],
  "step-up": ["Ponte de pie frente a un banco o escalón con una mancuerna en cada mano, con las palmas hacia tu cuerpo.","Coloca el pie derecho sobre el banco o escalón, asegurándote de que todo el pie esté en contacto con la superficie.","Empuja con el talón derecho y sube el cuerpo sobre el banco o escalón, enderezando la pierna derecha.","Sube el pie izquierdo hasta el banco o escalón, quedando completamente erguido.","Baja con el pie izquierdo, seguido del pie derecho, volviendo a la posición inicial.","Repite el número de repeticiones deseado, luego cambia de pierna."],
  "pistol-squat": ["Ponte de pie con los pies separados a la altura de los hombros, sujetando una pesa rusa frente al pecho con ambas manos.","Levanta el pie izquierdo del suelo y extiéndelo hacia adelante, manteniéndolo paralelo al suelo.","Baja lentamente el cuerpo a una posición de sentadilla, manteniendo el pie derecho plano en el suelo y la pierna izquierda extendida.","Haz una pausa breve en la parte baja de la sentadilla, luego empuja con el talón derecho para volver a la posición inicial.","Repite el número de repeticiones deseado, luego cambia de pierna."],
  "arnold-press": ["Siéntate en un banco con respaldo y sujeta una mancuerna en cada mano a la altura del hombro, con las palmas hacia tu cuerpo y los codos flexionados.","Empuja las mancuernas hacia arriba hasta que los brazos estén completamente extendidos y las palmas miren hacia adelante.","Rota las muñecas mientras levantas, de modo que las palmas miren hacia adelante en la parte alta del movimiento.","Haz una pausa breve en la parte alta, luego baja lentamente las mancuernas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "upright-row": ["Ponte de pie con los pies separados a la altura de los hombros y sujeta una barra con agarre prono, manos un poco más separadas que el ancho de los hombros.","Deja que la barra cuelgue frente a los muslos, con los brazos completamente extendidos.","Manteniendo la espalda recta y el core activado, exhala y levanta la barra en línea recta hacia la barbilla, guiando el movimiento con los codos.","Haz una pausa breve en la parte más alta, luego inhala y baja lentamente la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "preacher-curl": ["Siéntate en un banco predicador con los brazos superiores apoyados en el cojín y el pecho contra el soporte.","Agarra la barra con un agarre supino, un poco más ancho que la separación de los hombros.","Manteniendo los brazos superiores fijos, exhala y levanta la barra hacia los hombros.","Haz una pausa breve en la parte alta, apretando los bíceps.","Inhala y baja lentamente la barra de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "concentration-curl": ["Siéntate en un banco con las piernas separadas y una mancuerna en una mano, apoyando el codo en la parte interna del muslo.","Extiende completamente el brazo y sujeta la mancuerna con un agarre supino.","Manteniendo el brazo superior quieto, exhala y flexiona el peso hacia el hombro mientras contraes el bíceps.","Continúa levantando la mancuerna hasta que el bíceps esté completamente contraído y la mancuerna esté a la altura del hombro.","Mantén la posición contraída durante una breve pausa mientras aprietas los bíceps.","Inhala y baja lentamente la mancuerna de vuelta a la posición inicial.","Repite el número de repeticiones deseado, luego cambia de brazo."],
  "cable-curl": ["Ponte de pie frente a la máquina de cable con los pies separados a la altura de los hombros.","Sujeta el accesorio del cable con agarre supino, palmas hacia arriba.","Mantén los codos cerca de los costados y los brazos superiores quietos.","Exhala y flexiona el accesorio del cable hacia los hombros, contrayendo los bíceps.","Haz una pausa breve en la parte más alta del movimiento, contrayendo los bíceps.","Inhala y baja lentamente el accesorio del cable de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "tricep-kickback": ["Ponte de pie con los pies separados a la altura de los hombros, sujetando una mancuerna en cada mano.","Flexiona ligeramente las rodillas e inclínate hacia adelante desde las caderas, manteniendo la espalda recta.","Extiende los brazos rectos hacia atrás, manteniendo los codos cerca del cuerpo.","Haz una pausa breve en la parte alta, luego baja lentamente las mancuernas de vuelta a la posición inicial.","Repite con el otro brazo, alternando lados en cada repetición."],
  "mountain-climber": ["Comienza en una posición de plancha alta con las manos justo debajo de los hombros y el cuerpo en línea recta.","Activa el core y lleva la rodilla derecha hacia el pecho, luego cambia rápidamente y lleva la rodilla izquierda hacia el pecho.","Continúa alternando las piernas con un movimiento de carrera, manteniendo las caderas bajas y el core activado.","Mantén un ritmo constante y respira de forma regular durante todo el ejercicio.","Repite el número de repeticiones deseado."],
  "dead-bug": ["Túmbate boca arriba con los brazos extendidos hacia el techo.","Flexiona las rodillas y levanta las piernas del suelo, formando un ángulo de 90 grados en las caderas y las rodillas.","Activa el core y la zona lumbar para presionar la zona lumbar contra el suelo.","Baja lentamente el brazo derecho y la pierna izquierda hacia el suelo, manteniéndolos rectos y justo por encima del suelo.","Haz una pausa breve y luego vuelve a la posición inicial.","Repite el movimiento con el brazo izquierdo y la pierna derecha.","Continúa alternando lados durante el número de repeticiones deseado."],
  "sit-up": ["Túmbate sobre tu espalda con las rodillas flexionadas y los pies apoyados en el suelo.","Coloca las manos detrás de la cabeza con los codos apuntando hacia afuera.","Activando el abdomen, levanta lentamente la parte superior del cuerpo del suelo, curvándote hacia adelante hasta que tu torso forme un ángulo de 45 grados.","Al mismo tiempo, levanta las piernas del suelo, doblando las rodillas y llevándolas hacia el pecho.","Haz una pausa breve en la parte superior, luego baja lentamente la parte superior del cuerpo y las piernas a la posición inicial.","Repite el número de repeticiones deseado."],
  "farmers-walk": ["Ponte de pie con una mancuerna en cada mano, palmas hacia los costados.","Mantén la espalda recta y los hombros hacia atrás.","Da pasos pequeños y controlados hacia adelante, manteniendo una postura erguida.","Continúa caminando durante la distancia o el tiempo deseado.","Para terminar, deja de caminar y baja con cuidado las mancuernas a los costados."],
  "chest-press-machine": ["Ajusta la altura del asiento y colócate en la máquina con la espalda totalmente apoyada en la almohadilla.","Sujeta las asas con un agarre prono y coloca los codos en un ángulo de 90 grados.","Empuja las asas hacia adelante hasta que los brazos queden completamente extendidos, exhalando durante el movimiento.","Haz una pausa breve al final del movimiento, luego vuelve lentamente a la posición inicial, inhalando mientras lo haces.","Repite el número de repeticiones deseado."],
  "trap-bar-deadlift": ["Ponte de pie con los pies separados a la altura de los hombros y la barra hexagonal en el suelo frente a ti.","Flexiona las caderas y las rodillas para bajar y agarra las asas de la barra hexagonal con un agarre prono.","Mantén la espalda recta y el pecho elevado mientras comienzas a levantar la barra hexagonal del suelo extendiendo las caderas y las rodillas.","Al levantar, concéntrate en empujar con los talones y contraer los glúteos en la parte superior del movimiento.","Baja la barra hexagonal de nuevo al suelo flexionando las caderas y las rodillas, manteniendo la espalda recta durante todo el movimiento.","Repite el número de repeticiones deseado."],
  "glute-bridge": ["Empieza tumbado boca arriba en el suelo con las rodillas flexionadas y los pies planos sobre el suelo.","Coloca una barra sobre las caderas, sujetándola con firmeza con ambas manos.","Activa los glúteos y el core, luego levanta las caderas del suelo hasta que el cuerpo forme una línea recta desde las rodillas hasta los hombros.","Haz una pausa breve en la parte alta, apretando los glúteos.","Baja lentamente las caderas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "hack-squat": ["Empieza de pie con los pies separados a la altura de los hombros y los dedos de los pies ligeramente hacia afuera.","Sujeta la barra detrás de las piernas, apoyándola en la parte superior de los muslos.","Baja el cuerpo flexionando las rodillas y las caderas, manteniendo la espalda recta y el pecho elevado.","Continúa bajando hasta que los muslos queden paralelos al suelo, o tan abajo como puedas hacerlo cómodamente.","Haz una pausa breve y luego empuja con los talones para volver a la posición inicial.","Repite el número de repeticiones deseado."],
  "walking-lunge": ["Ponte de pie con los pies separados a la altura de los hombros.","Da un paso adelante con la pierna derecha, bajando el cuerpo a una posición de zancada.","Mantén el torso erguido y la rodilla delantera alineada con el tobillo.","Empújate con el pie derecho y lleva el pie izquierdo hacia adelante, entrando en una posición de zancada con la pierna izquierda.","Continúa alternando las piernas y avanzando, manteniendo un ritmo controlado y constante.","Repite el número de repeticiones deseado."],
  "seated-calf-raise": ["Ajusta la altura del asiento de modo que las rodillas queden ligeramente flexionadas y los pies queden planos sobre la placa para los pies.","Coloca los dedos de los pies sobre la placa para los pies, con los talones colgando fuera del borde.","Sujeta las asas o los lados del asiento para mayor estabilidad.","Empuja con la parte delantera de los pies para elevar los talones tan alto como sea posible.","Haz una pausa breve en la parte alta y luego baja lentamente los talones de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "hip-abduction": ["Ajusta la altura del asiento de modo que tus rodillas formen un ángulo de 90 grados.","Siéntate en la máquina con la espalda apoyada en el respaldo y los pies sobre los apoyapiés.","Coloca las manos en las asas laterales para mayor estabilidad.","Activa los abductores y empuja lentamente las piernas hacia afuera, alejándolas de la línea media del cuerpo.","Haz una pausa al final del movimiento y luego junta lentamente las piernas de nuevo hasta la posición inicial.","Repite el número de repeticiones deseado."],
  "hip-adduction": ["Ajusta la altura del asiento y colócate en la máquina con la espalda apoyada en el respaldo.","Coloca los pies sobre los apoyapiés y agarra las asas para mayor estabilidad.","Activa los aductores y junta lentamente las piernas, apretando la parte interna de los muslos.","Haz una pausa breve en el punto máximo de contracción, luego vuelve lentamente a la posición inicial.","Repite el número de repeticiones deseado."],
  "cable-pull-through": ["Ponte de pie de espaldas a la máquina de cable con los pies separados a la altura de los hombros.","Agarra el accesorio de cuerda con ambas manos y da un paso hacia adelante, creando tensión en el cable.","Flexiona las caderas y baja la parte superior del cuerpo hasta que quede paralela al suelo, manteniendo la espalda recta.","Activa los glúteos y los isquiotibiales para llevar el cuerpo de vuelta hacia arriba, a la posición inicial.","Repite el número de repeticiones deseado."],
  "lying-leg-raise": ["Túmbate en un banco plano con la espalda presionada contra él.","Coloca las manos debajo de los glúteos como apoyo.","Mantén las piernas rectas y juntas, y elévalas hacia el techo.","Haz una pausa por un momento en la parte superior, luego baja lentamente las piernas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "reverse-crunch": ["Túmbate boca arriba con los brazos extendidos a los lados del cuerpo.","Flexiona las rodillas y levanta los pies del suelo, llevando los muslos perpendiculares al suelo.","Contrae el abdomen y eleva las caderas del suelo, llevando las rodillas hacia el pecho.","Haz una pausa por un momento en la parte superior, luego baja lentamente las caderas de vuelta a la posición inicial.","Repite el número de repeticiones deseado."],
  "side-bend": ["Ponte de pie con la espalda recta y los pies separados a la altura de los hombros, sujetando una mancuerna con una mano y dejando que cuelgue a tu costado.","Manteniendo la espalda recta y el core activado, inclínate lentamente hacia el lado opuesto de la mancuerna, bajando el peso tanto como te sea posible con comodidad.","Haz una pausa por un momento, luego regresa lentamente a la posición inicial.","Repite el número de repeticiones deseado, luego cambia de lado y repite."],
  "pallof-press": ["Sujeta la banda a un punto de anclaje resistente a la altura de la cintura.","Ponte de pie perpendicular al punto de anclaje con los pies separados a la altura de los hombros.","Agarra la agarradera de la banda con ambas manos y aléjate del punto de anclaje para generar tensión en la banda.","Lleva las manos hacia el pecho, manteniendo los codos flexionados y cerca del cuerpo.","Activa el core y mantén una postura estable.","Extiende los brazos rectos frente a ti, empujando la banda alejándola del cuerpo.","Mantén la posición extendida durante unos segundos, enfocándote en mantener la tensión en el core.","Lleva lentamente las manos de vuelta al pecho, resistiendo el tirón de la banda.","Repite el número de repeticiones deseado."],
}

export const EXERCISE_INSTRUCTIONS_ES: Record<string, string[]> = {
  ...CURATED_EXERCISE_INSTRUCTIONS_ES,
  ...(extraInstructionsData as Record<string, string[]>),
}

/* --------------------------------- Routines --------------------------------- */

export interface RoutineExercise {
  exerciseName: string
  targetSets: number
  targetReps: number
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  createdAt: number | null
}

export interface RoutineInput {
  name: string
  exercises: RoutineExercise[]
}

function routinesRef(uid: string) {
  return collection(firestore(), "users", uid, "gymRoutines")
}

export async function fetchRoutines(uid: string): Promise<Routine[]> {
  const snap = await getDocs(routinesRef(uid))
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      const createdAt = data.createdAt
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        exercises: (data.exercises as RoutineExercise[]) ?? [],
        createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
      }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function createRoutine(uid: string, input: RoutineInput): Promise<string> {
  const ref = await addDoc(routinesRef(uid), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateRoutine(uid: string, id: string, input: RoutineInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "gymRoutines", id), { ...input })
}

export async function deleteRoutine(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "gymRoutines", id))
}

/* --------------------------------- Workouts --------------------------------- */

export interface SetLog {
  reps: number
  weightKg: number
  completed: boolean
}

export interface WorkoutExercise {
  exerciseName: string
  sets: SetLog[]
}

export interface Workout {
  id: string
  /** ISO date (YYYY-MM-DD) the workout happened. */
  date: string
  name: string
  routineId: string | null
  exercises: WorkoutExercise[]
  durationMin: number | null
  notes: string
  createdAt: number | null
}

export interface WorkoutInput {
  date: string
  name: string
  routineId: string | null
  exercises: WorkoutExercise[]
  durationMin: number | null
  notes: string
}

function workoutsRef(uid: string) {
  return collection(firestore(), "users", uid, "gymWorkouts")
}

export async function fetchWorkouts(uid: string): Promise<Workout[]> {
  const q = query(workoutsRef(uid), orderBy("date", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const createdAt = data.createdAt
    return {
      id: d.id,
      date: (data.date as string) ?? "",
      name: (data.name as string) ?? "Entrenamiento",
      routineId: (data.routineId as string) ?? null,
      exercises: (data.exercises as WorkoutExercise[]) ?? [],
      durationMin: data.durationMin != null ? Number(data.durationMin) : null,
      notes: (data.notes as string) ?? "",
      createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : null,
    }
  })
}

export async function createWorkout(uid: string, input: WorkoutInput): Promise<string> {
  const ref = await addDoc(workoutsRef(uid), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateWorkout(uid: string, id: string, input: WorkoutInput): Promise<void> {
  await updateDoc(doc(firestore(), "users", uid, "gymWorkouts", id), { ...input })
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "gymWorkouts", id))
}

/* ------------------------------ Derived stats ------------------------------- */

export interface PersonalRecord {
  exerciseName: string
  maxWeightKg: number
  repsAtMaxWeight: number
  date: string
  /** Epley formula estimated 1-rep max. */
  estimated1RM: number
}

/** Best set per exercise across all workouts, ranked by estimated 1RM. */
export function computePersonalRecords(workouts: Workout[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (!set.completed || set.weightKg <= 0 || set.reps <= 0) continue
        const est1RM = Math.round(set.weightKg * (1 + set.reps / 30) * 10) / 10
        const existing = map.get(ex.exerciseName)
        if (!existing || est1RM > existing.estimated1RM) {
          map.set(ex.exerciseName, {
            exerciseName: ex.exerciseName,
            maxWeightKg: set.weightKg,
            repsAtMaxWeight: set.reps,
            date: w.date,
            estimated1RM: est1RM,
          })
        }
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.estimated1RM - a.estimated1RM)
}

/** Total weight moved (kg) across completed sets in a workout. */
export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.completed ? set.weightKg * set.reps : 0), 0),
    0,
  )
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0)
}

/* --------------------------- Sobrecarga progresiva --------------------------- */

export interface LoadSuggestion {
  weightKg: number
  reps: number
  basedOn: { date: string; weightKg: number; reps: number }
}

/**
 * Sugiere el próximo peso/reps para un ejercicio, basado en la última vez
 * que se registró — "doble progresión": si ya se llegó a 10+ reps promedio
 * con el mejor peso, sube el peso un poco (y baja las reps objetivo); si no,
 * primero suma una repetición antes de subir peso. Es una heurística de
 * entrenamiento estándar, no una recomendación médica ni personalizada.
 */
export function suggestNextLoad(workouts: Workout[], exerciseName: string): LoadSuggestion | null {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
  for (const w of sorted) {
    const ex = w.exercises.find((e) => e.exerciseName === exerciseName)
    if (!ex) continue
    const completed = ex.sets.filter((s) => s.completed && s.weightKg > 0 && s.reps > 0)
    if (completed.length === 0) continue

    const bestSet = completed.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))
    const avgReps = Math.round(completed.reduce((sum, s) => sum + s.reps, 0) / completed.length)

    let nextWeight = bestSet.weightKg
    let nextReps = avgReps
    if (avgReps >= 10) {
      const bump = bestSet.weightKg >= 20 ? 2.5 : 1
      nextWeight = Math.round((bestSet.weightKg + bump) * 2) / 2
      nextReps = Math.max(6, avgReps - 2)
    } else {
      nextReps = avgReps + 1
    }

    return {
      weightKg: nextWeight,
      reps: nextReps,
      basedOn: { date: w.date, weightKg: bestSet.weightKg, reps: bestSet.reps },
    }
  }
  return null
}

/* ------------------------------ Rango por ejercicio ------------------------------ */

export type ExerciseRank = "Bronce" | "Plata" | "Oro" | "Platino" | "Diamante"

export interface ExerciseRankInfo {
  rank: ExerciseRank
  currentEst1RM: number
  firstEst1RM: number
  improvementPct: number
  sessionsLogged: number
}

const RANK_TIERS: { rank: ExerciseRank; minImprovementPct: number; minSessions: number }[] = [
  { rank: "Diamante", minImprovementPct: 40, minSessions: 8 },
  { rank: "Platino", minImprovementPct: 25, minSessions: 6 },
  { rank: "Oro", minImprovementPct: 15, minSessions: 4 },
  { rank: "Plata", minImprovementPct: 5, minSessions: 2 },
  { rank: "Bronce", minImprovementPct: 0, minSessions: 0 },
]

/**
 * Rango de un ejercicio basado en TU PROPIO progreso (no en estándares de
 * fuerza poblacionales — esos varían demasiado por sexo/edad/experiencia
 * como para presentarlos como un dato confiable). Compara tu 1RM estimado
 * actual contra tu primer registro de ese ejercicio.
 */
export function computeExerciseRank(workouts: Workout[], exerciseName: string): ExerciseRankInfo | null {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const attempts: number[] = []
  for (const w of sorted) {
    const ex = w.exercises.find((e) => e.exerciseName === exerciseName)
    if (!ex) continue
    const best = ex.sets
      .filter((s) => s.completed && s.weightKg > 0 && s.reps > 0)
      .reduce((max, s) => Math.max(max, s.weightKg * (1 + s.reps / 30)), 0)
    if (best > 0) attempts.push(Math.round(best * 10) / 10)
  }
  if (attempts.length === 0) return null

  const first = attempts[0]
  const current = Math.max(...attempts)
  const improvementPct = first > 0 ? Math.round(((current - first) / first) * 100) : 0
  const tier =
    RANK_TIERS.find((t) => improvementPct >= t.minImprovementPct && attempts.length >= t.minSessions) ??
    RANK_TIERS[RANK_TIERS.length - 1]

  return {
    rank: tier.rank,
    currentEst1RM: current,
    firstEst1RM: first,
    improvementPct,
    sessionsLogged: attempts.length,
  }
}

export const RANK_COLORS: Record<ExerciseRank, string> = {
  Bronce: "oklch(0.6 0.1 50)",
  Plata: "oklch(0.75 0.02 260)",
  Oro: "oklch(0.8 0.16 80)",
  Platino: "oklch(0.85 0.03 220)",
  Diamante: "oklch(0.75 0.15 220)",
}
