import { NextResponse } from 'next/server'

/**
 * Server-only route: calls Groq to suggest personalized nutrition targets
 * (calories/macros/water) grounded in the client's own BMR/TDEE calculation.
 * Keeps GROQ_API_KEY off the client — the browser never sees it, only this
 * route does (same Groq account/free tier already used by apps-script/Code.gs
 * for bank-email categorization, just a separate key so each side can be
 * rotated independently).
 */

interface RequestBody {
  sex: 'male' | 'female'
  weightKg: number
  heightCm: number
  age: number
  activityLevel: string
  goal: 'lose' | 'maintain' | 'gain'
  bmr: number
  tdee: number
}

interface PlanResult {
  calories: number
  protein: number
  carbs: number
  fat: number
  water: number
  rationale: string
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'sedentario, poco o nada de ejercicio',
  light: 'actividad ligera, 1-3 días por semana',
  moderate: 'actividad moderada, 3-5 días por semana',
  active: 'activo, 6-7 días por semana',
  very_active: 'muy activo, entrenamiento intenso a diario',
}

const GOAL_LABELS: Record<string, string> = {
  lose: 'bajar de peso de forma sostenible',
  maintain: 'mantener su peso actual',
  gain: 'subir de peso / ganar masa muscular',
}

function buildPrompt(body: RequestBody): string {
  return (
    `Sos un nutricionista. Con estos datos de una persona, sugerí metas diarias de calorías, ` +
    `macronutrientes y agua.\n\n` +
    `- Sexo: ${body.sex === 'male' ? 'hombre' : 'mujer'}\n` +
    `- Peso: ${body.weightKg} kg\n` +
    `- Estatura: ${body.heightCm} cm\n` +
    `- Edad: ${body.age} años\n` +
    `- Nivel de actividad: ${ACTIVITY_LABELS[body.activityLevel] ?? body.activityLevel}\n` +
    `- Objetivo: ${GOAL_LABELS[body.goal] ?? body.goal}\n` +
    `- BMR calculado (Mifflin-St Jeor): ${body.bmr} kcal\n` +
    `- TDEE calculado (gasto total diario): ${body.tdee} kcal\n\n` +
    `Usá el TDEE como base y ajustalo según el objetivo (déficit moderado y sostenible para bajar de ` +
    `peso, superávit moderado para subir/ganar músculo, igual al TDEE para mantener). La proteína debe ` +
    `ser suficiente para el objetivo (más alta si busca ganar músculo o está en déficit, para preservar ` +
    `masa magra). El agua se mide en vasos de 250ml/día, calculada según el peso y el nivel de actividad ` +
    `(referencia general: ~35ml por kg de peso, más si la actividad es alta).\n\n` +
    `Respondé ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido, sin introducciones ni bloques markdown. ` +
    `Formato exacto:\n` +
    `{\n` +
    `  "calories": <entero, kcal/día>,\n` +
    `  "protein": <entero, gramos/día>,\n` +
    `  "carbs": <entero, gramos/día>,\n` +
    `  "fat": <entero, gramos/día>,\n` +
    `  "water": <entero, vasos de 250ml/día>,\n` +
    `  "rationale": "<explicación breve en español, 1-2 oraciones, del porqué de estos números>"\n` +
    `}`
  )
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/** Parses and sanity-checks the model's JSON — never trust an LLM's numbers blindly for health guidance. */
function parseAndValidate(content: string): PlanResult | null {
  let parsed: unknown
  try {
    // Models occasionally wrap JSON in a markdown fence despite instructions — strip it defensively.
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>

  if (!isFiniteInRange(p.calories, 1000, 6000)) return null
  if (!isFiniteInRange(p.protein, 0, 500)) return null
  if (!isFiniteInRange(p.carbs, 0, 900)) return null
  if (!isFiniteInRange(p.fat, 0, 300)) return null
  if (!isFiniteInRange(p.water, 4, 20)) return null
  if (typeof p.rationale !== 'string' || p.rationale.length === 0 || p.rationale.length > 500) return null

  return {
    calories: Math.round(p.calories),
    protein: Math.round(p.protein),
    carbs: Math.round(p.carbs),
    fat: Math.round(p.fat),
    water: Math.round(p.water),
    rationale: p.rationale,
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY no está configurada en el servidor.' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (
    !body ||
    (body.sex !== 'male' && body.sex !== 'female') ||
    !isFiniteInRange(body.weightKg, 20, 400) ||
    !isFiniteInRange(body.heightCm, 100, 250) ||
    !isFiniteInRange(body.age, 10, 120) ||
    !isFiniteInRange(body.bmr, 500, 5000) ||
    !isFiniteInRange(body.tdee, 500, 8000)
  ) {
    return NextResponse.json({ error: 'Datos de perfil incompletos o fuera de rango.' }, { status: 400 })
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: buildPrompt(body) }],
        temperature: 0.3,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', groqResponse.status, errorText)
      return NextResponse.json({ error: 'El servicio de IA no respondió correctamente.' }, { status: 502 })
    }

    const data = await groqResponse.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'Respuesta vacía del servicio de IA.' }, { status: 502 })
    }

    const plan = parseAndValidate(content)
    if (!plan) {
      return NextResponse.json({ error: 'La IA devolvió datos que no se pudieron interpretar.' }, { status: 502 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error llamando a Groq:', error)
    return NextResponse.json({ error: 'No se pudo contactar al servicio de IA.' }, { status: 502 })
  }
}
