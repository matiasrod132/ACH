import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Encrypts credentials that must be stored as-is (not one-way hashed) so
// they can be used later — IMAP app passwords, specifically. Unlike an
// OAuth refresh token (which the provider can revoke independently), this
// is a real account credential, so it's encrypted at rest with AES-256-GCM
// rather than just relying on Firestore rules blocking client reads (still
// does that too — see firestore.rules — this is defense in depth).

export interface EncryptedSecret {
  encrypted: string
  iv: string
  authTag: string
}

function getKey(): Buffer {
  const secret = process.env.IMAP_CREDENTIALS_ENCRYPTION_KEY
  if (!secret) throw new Error('Falta IMAP_CREDENTIALS_ENCRYPTION_KEY en el servidor.')
  // scrypt derives a proper 32-byte key from a secret of any length/format.
  return scryptSync(secret, 'starklab-imap-credentials', 32)
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptSecret(data: EncryptedSecret): string {
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(data.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(data.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data.encrypted, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf-8')
}
