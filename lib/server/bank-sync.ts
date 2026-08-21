import { createHash } from 'crypto'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/movement-categories'

// Server-only. Ported from apps-script/Code.gs so the exact same detection
// rules (which emails count as a real transaction, how they're categorized)
// apply whether a user connects their own Apps Script (single-user, the
// original path) or the multi-user OAuth + cron sync below. Keep both in
// sync if the rules ever change — see apps-script/Code.gs's own comments
// for the reasoning behind each pattern.

export const REMITENTES_TRANSACCIONALES = [
  'BancoGuayaquil@bancoguayaquil.com',
  'bancavirtual@bancoguayaquil.com',
]

export const PATRONES_ASUNTO_TRANSACCION = ['Consumo por', 'Orden de']

const FRASES_TRANSACCION_NO_EFECTIVA = [
  'rechazad',
  'declinad',
  'denegad',
  'no autorizad',
  'no exitosa',
  'no procesada',
  'no pudo ser procesada',
  'no se pudo procesar',
  'no se pudo completar',
  'no se pudo realizar',
  'fondos insuficientes',
  'saldo insuficiente',
  'transacción fallida',
  'transaccion fallida',
  'transacción reversada',
  'transaccion reversada',
  'reverso de',
]

/** Gmail search query — sender AND subject-pattern filters combined, same as busquedaGmailTransaccional_ in Apps Script. */
export function buildGmailQuery(extra?: string): string {
  const remitentes = `from:(${REMITENTES_TRANSACCIONALES.join(' OR ')})`
  const asuntos = `subject:(${PATRONES_ASUNTO_TRANSACCION.map((p) => `"${p}"`).join(' OR ')})`
  return `${remitentes} ${asuntos}${extra ? ' ' + extra : ''}`
}

export function shouldSkipEmail(subject: string, fullText: string): { skip: boolean; reason?: string } {
  const subjectLower = subject.toLowerCase()
  if (
    subjectLower.includes('acceso con exito') ||
    subjectLower.includes('activa') ||
    subjectLower.includes('clave')
  ) {
    return { skip: true, reason: 'acceso/activación' }
  }

  const textLower = fullText.toLowerCase()
  const frase = FRASES_TRANSACCION_NO_EFECTIVA.find((f) => textLower.includes(f))
  if (frase) return { skip: true, reason: `transacción no efectiva ("${frase}")` }

  return { skip: false }
}

export interface DatosBase {
  amount: number
  description: string
  type: 'income' | 'expense'
  category: string
}

/** Keyword-based fallback categorizer — no AI required. Ported from extraerDatosBancoNativo_. */
export function extraerDatosBancoNativo(texto: string): DatosBase | null {
  const matchMonto = texto.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/)
  if (!matchMonto?.[1]) return null

  const amount = Number.parseFloat(matchMonto[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  let description = 'Transacción Banco Guayaquil'
  let type: 'income' | 'expense' = 'expense'
  let category = 'Otro'

  const textoMinuscula = texto.toLowerCase()

  const matchAhorroMeta =
    texto.match(/transferencia\s+(.+?)\s+meta\b/i) || texto.match(/orden de\s+(.+?)\s+meta\b/i)

  if (matchAhorroMeta) {
    const nombre = matchAhorroMeta[1]?.trim()
    description = nombre
      ? `Movimiento de Ahorro Meta: ${nombre} (revisa si fue aporte o retiro)`
      : 'Movimiento de Ahorro Meta (revisa si fue aporte o retiro)'
    type = 'expense'
    category = 'Ahorro'
  } else if (
    textoMinuscula.includes('recibida') ||
    textoMinuscula.includes('depósito') ||
    textoMinuscula.includes('deposito') ||
    textoMinuscula.includes('acreditación') ||
    textoMinuscula.includes('acreditacion') ||
    textoMinuscula.includes('transferencia de') ||
    textoMinuscula.includes('ingreso') ||
    textoMinuscula.includes('abono')
  ) {
    description = 'Transferencia recibida / depósito'
    type = 'income'
    category = 'Transferencia'
  } else if (textoMinuscula.includes('retiro')) {
    description = 'Retiro en efectivo'
    type = 'expense'
    category = 'Retiro'
  } else if (
    textoMinuscula.includes('compra') ||
    textoMinuscula.includes('consumo') ||
    textoMinuscula.includes('debito') ||
    textoMinuscula.includes('débito')
  ) {
    description = 'Consumo / compra con tarjeta'
    type = 'expense'
    if (/restaurante|comida|delivery|supermercado|supermaxi|comisariato/.test(textoMinuscula)) {
      category = 'Comida'
    } else if (/taxi|uber|cabify|gasolina|combustible/.test(textoMinuscula)) {
      category = 'Transporte'
    } else if (/suscrip|mensualidad|streaming|netflix|spotify/.test(textoMinuscula)) {
      category = 'Suscripción'
    }
  }

  return { amount, description, type, category }
}

/** Optional AI refinement of category/description via Groq — mirrors construirPeticionGroq_/procesarRespuestaGroq_. */
export async function categorizeWithGroq(
  texto: string,
  datosBase: DatosBase,
  apiKey: string,
  model: string,
): Promise<{ category: string; description: string } | null> {
  const categorias = datosBase.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const prompt =
    'Analiza esta notificación bancaria de Banco Guayaquil y deduce el comercio o motivo.\n\n' +
    `Texto del correo:\n"""\n${texto}\n"""\n\n` +
    `Datos base detectados:\n- Monto: $${datosBase.amount}\n- Tipo: ${datosBase.type}\n\n` +
    'Elige la categoría MÁS adecuada de esta lista exacta (responde el texto tal cual, sin traducir ni inventar otras):\n' +
    categorias.map((c) => `"${c}"`).join(', ') +
    '\n\nResponde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido, sin introducciones ni bloques markdown. Formato exacto:\n' +
    '{\n  "category": "una de las categorías listadas",\n  "description": "descripción corta y limpia (ej: \'Compra en Supermaxi\')"\n}'

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
    })
    if (!response.ok) return null

    const data = await response.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) return null

    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
    const parsed = JSON.parse(cleaned) as { category?: string; description?: string }
    if (!parsed.category || !(categorias as readonly string[]).includes(parsed.category)) return null

    return { category: parsed.category, description: parsed.description || datosBase.description }
  } catch {
    return null
  }
}

/** Deterministic Firestore doc id from a Gmail message id — same scheme as rutaMovimiento_/safeId_ in Apps Script. */
export function movementDocId(gmailMessageId: string): string {
  const digest = createHash('sha256').update(gmailMessageId).digest('base64url')
  return 'bg_' + digest.slice(0, 36)
}

// ==================== Google OAuth + Gmail REST ====================

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null

  const data = await response.json()
  return typeof data.access_token === 'string' ? data.access_token : null
}

export async function gmailListMessageIds(accessToken: string, query: string): Promise<string[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data.messages) ? data.messages.map((m: { id: string }) => m.id) : []
}

interface GmailMessagePart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePart[]
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

function extractTextFromParts(part: GmailMessagePart): { plain: string | null; html: string | null } {
  let plain: string | null = null
  let html: string | null = null

  function walk(p: GmailMessagePart) {
    if (p.mimeType === 'text/plain' && p.body?.data && !plain) plain = decodeBase64Url(p.body.data)
    if (p.mimeType === 'text/html' && p.body?.data && !html) html = decodeBase64Url(p.body.data)
    p.parts?.forEach(walk)
  }
  walk(part)

  return { plain, html }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface GmailMessage {
  id: string
  subject: string
  bodyText: string
  internalDate: number
}

export async function gmailGetMessage(accessToken: string, id: string): Promise<GmailMessage | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) return null

  const data = await response.json()
  const headers: { name: string; value: string }[] = data.payload?.headers ?? []
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''

  const { plain, html } = extractTextFromParts(data.payload ?? {})
  const bodyText = plain ?? (html ? stripHtml(html) : '')

  return {
    id,
    subject,
    bodyText,
    internalDate: Number(data.internalDate) || Date.now(),
  }
}

export async function gmailMarkRead(accessToken: string, id: string): Promise<void> {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  })
}
