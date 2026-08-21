import { createHmac, timingSafeEqual } from 'crypto'

// Signs a short-lived {uid, timestamp} state param for the Gmail OAuth
// redirect — prevents a forged `state` from linking a stranger's Gmail
// account to another user's uid. Not a session/cookie; just a signed,
// self-contained token good for a few minutes (the length of an OAuth
// consent redirect round-trip).

const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

function secret(): string {
  const s = process.env.OAUTH_STATE_SECRET
  if (!s) throw new Error('Falta OAUTH_STATE_SECRET en el servidor.')
  return s
}

export function signState(uid: string): string {
  const payload = `${uid}.${Date.now()}`
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

export function verifyState(state: string): string | null {
  const [payloadB64, signature] = state.split('.')
  if (!payloadB64 || !signature) return null

  const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url')

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const [uid, tsStr] = payload.split('.')
  const ts = Number(tsStr)
  if (!uid || !Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) return null

  return uid
}
