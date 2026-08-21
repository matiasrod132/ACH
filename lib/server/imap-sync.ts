import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { matchesTransactionalPattern, processEmailCandidate, type ProcessOutcome } from '@/lib/server/bank-sync'

// Provider-agnostic email sync via plain IMAP + an app password — the
// alternative to the Gmail-specific OAuth path (lib/server/bank-sync.ts's
// Gmail REST helpers) for users on Outlook, Yahoo, iCloud, or any other
// IMAP-compatible provider. No OAuth consent screen, no Google brand
// verification, no per-provider app registration — just standard IMAP,
// which every major provider supports via an app-specific password.

export interface ImapCredentials {
  host: string
  port: number
  email: string
  password: string
}

function buildClient(creds: ImapCredentials): ImapFlow {
  return new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: true,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
}

/** Attempts a login only (no fetch) — used to validate credentials before saving them. */
export async function testImapLogin(creds: ImapCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = buildClient(creds)
  try {
    await client.connect()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo conectar.' }
  } finally {
    try {
      await client.logout()
    } catch {
      // Already disconnected if connect() itself failed — nothing to clean up.
    }
  }
}

export interface ImapSyncResult {
  created: number
  duplicates: number
  skipped: number
  errors: number
}

/**
 * Connects, finds unread transactional-looking messages (cheap envelope-only
 * pass first, matching the same sender+subject rule Gmail's own query
 * applies), then for each match: fetches the full body, runs it through the
 * shared categorize/dedupe/save/push pipeline, and marks it read.
 */
export async function syncImapUser(
  uid: string,
  creds: ImapCredentials,
  groqApiKey: string | undefined,
  groqModel: string,
): Promise<ImapSyncResult> {
  const result: ImapSyncResult = { created: 0, duplicates: 0, skipped: 0, errors: 0 }
  const client = buildClient(creds)

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Phase 1: cheap envelope-only pass over unseen mail to find matches.
      const matches: { uid: number; messageId: string; subject: string }[] = []
      for await (const msg of client.fetch({ seen: false }, { envelope: true, uid: true })) {
        const from = msg.envelope?.from?.[0]?.address ?? ''
        const subject = msg.envelope?.subject ?? ''
        if (matchesTransactionalPattern(from, subject)) {
          matches.push({ uid: msg.uid, messageId: msg.envelope?.messageId || `imap-${creds.email}-${msg.uid}`, subject })
        }
      }

      // Phase 2: only the matches get their full body downloaded/parsed.
      for (const match of matches) {
        try {
          const fetched = await client.fetchOne(String(match.uid), { source: true }, { uid: true })
          if (!fetched || !fetched.source) {
            result.errors++
            continue
          }

          const parsed = await simpleParser(fetched.source)
          const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '')
          const date = (parsed.date ?? new Date()).toISOString().slice(0, 10)

          const outcome: ProcessOutcome = await processEmailCandidate(
            uid,
            { id: match.messageId, subject: match.subject, bodyText, date },
            'email_imap_sync',
            groqApiKey,
            groqModel,
          )

          if (outcome === 'created') result.created++
          else if (outcome === 'duplicate') result.duplicates++
          else result.skipped++

          await client.messageFlagsAdd(match.uid, ['\\Seen'], { uid: true })
        } catch (err) {
          console.error(`[imap-sync] Error procesando mensaje ${match.uid} para ${uid}:`, err)
          result.errors++
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    try {
      await client.logout()
    } catch {
      // Connection may already be closed — nothing to clean up.
    }
  }

  return result
}
