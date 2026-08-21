import { createPublicKey, verify as cryptoVerify } from 'crypto'

// Deliberately does NOT use firebase-admin/auth's verifyIdToken(). That
// pulls in `jwks-rsa`, which does a plain require('jose') against a build
// of `jose` that's ESM-only at that resolved path — breaks with
// ERR_REQUIRE_ESM the moment it actually runs on Netlify Functions (and
// Vercel hits the same class of issue), regardless of webpack vs Turbopack,
// because the bug is in jwks-rsa's own source, not something a bundler flag
// fixes. This does the exact same check (RS256 signature against Google's
// rotating public keys + standard claim validation) with zero extra
// dependencies — just Node's built-in `crypto` and `fetch`.

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const CERT_CACHE_MS = 60 * 60 * 1000 // Google rotates these infrequently; an hour is plenty.

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs

  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) throw new Error('No se pudieron obtener los certificados públicos de Google.')

  const certs = (await response.json()) as Record<string, string>
  certCache = { certs, expiresAt: Date.now() + CERT_CACHE_MS }
  return certs
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

export interface VerifiedFirebaseToken {
  uid: string
  email?: string
}

/** Verifies a Firebase Auth ID token (RS256 JWT). Returns null on any invalid/expired/malformed token. */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken | null> {
  try {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    if (!projectId) return null

    const [headerB64, payloadB64, signatureB64] = idToken.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) return null

    const header = JSON.parse(base64UrlDecode(headerB64).toString('utf-8')) as { alg?: string; kid?: string }
    if (header.alg !== 'RS256' || !header.kid) return null

    const certs = await getGoogleCerts()
    const cert = certs[header.kid]
    if (!cert) return null

    const signedData = Buffer.from(`${headerB64}.${payloadB64}`)
    const signature = base64UrlDecode(signatureB64)
    const publicKey = createPublicKey(cert)
    if (!cryptoVerify('RSA-SHA256', signedData, publicKey, signature)) return null

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8')) as Record<string, unknown>
    const now = Math.floor(Date.now() / 1000)

    if (typeof payload.exp !== 'number' || payload.exp < now) return null
    if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null
    if (payload.aud !== projectId) return null
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
    if (typeof payload.sub !== 'string' || !payload.sub) return null

    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
  } catch {
    return null
  }
}
