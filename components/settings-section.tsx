'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bell, BellOff, BellRing, Inbox, Mail, MailCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { useGame } from '@/lib/game-context'
import { NOTIFICATION_PROMPT_DISMISSED_KEY } from '@/components/notification-prompt'
import { scheduleLocalReminder } from '@/lib/local-reminders'
import { registerPushToken } from '@/lib/push-notifications'
import { connectGmail, disconnectGmail, fetchGmailSyncStatus, type GmailSyncStatus } from '@/lib/gmail-sync'
import {
  connectImap,
  disconnectImap,
  fetchImapSyncStatus,
  IMAP_PROVIDER_PRESETS,
  type ImapSyncStatus,
} from '@/lib/imap-sync-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

function readPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function SettingsSection() {
  const { user } = useGame()
  const searchParams = useSearchParams()
  const [permission, setPermission] = useState<PermissionState>('default')
  const [requesting, setRequesting] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [pushRegistered, setPushRegistered] = useState<boolean | null>(null)

  const [gmailStatus, setGmailStatus] = useState<GmailSyncStatus | null>(null)
  const [gmailBusy, setGmailBusy] = useState(false)

  const [imapStatus, setImapStatus] = useState<ImapSyncStatus | null>(null)
  const [imapBusy, setImapBusy] = useState(false)
  const [imapForm, setImapForm] = useState<{ email: string; host: string; port: string; password: string }>({
    email: '',
    host: IMAP_PROVIDER_PRESETS[0].host,
    port: String(IMAP_PROVIDER_PRESETS[0].port),
    password: '',
  })
  const [imapFormOpen, setImapFormOpen] = useState(false)
  const [imapAdvancedOpen, setImapAdvancedOpen] = useState(false)

  useEffect(() => {
    setPermission(readPermission())
  }, [])

  useEffect(() => {
    if (user) fetchGmailSyncStatus(user.uid).then(setGmailStatus)
  }, [user])

  useEffect(() => {
    if (user) fetchImapSyncStatus(user.uid).then(setImapStatus)
  }, [user])

  useEffect(() => {
    const gmailResult = searchParams.get('gmail')
    if (gmailResult === 'connected') {
      toast.success('Gmail conectado — el sync de movimientos ya está activo.')
      if (user) fetchGmailSyncStatus(user.uid).then(setGmailStatus)
    } else if (gmailResult === 'denied') {
      toast.error('Cancelaste la conexión con Gmail.')
    } else if (gmailResult === 'error') {
      toast.error('No se pudo conectar Gmail — intentá de nuevo.')
    }
  }, [searchParams, user])

  async function handleConnectGmail() {
    setGmailBusy(true)
    try {
      await connectGmail()
    } catch {
      toast.error('No se pudo iniciar la conexión con Gmail.')
      setGmailBusy(false)
    }
  }

  async function handleDisconnectGmail() {
    setGmailBusy(true)
    try {
      await disconnectGmail()
      setGmailStatus({ connected: false, email: '' })
      toast.success('Gmail desconectado.')
    } catch {
      toast.error('No se pudo desconectar Gmail.')
    } finally {
      setGmailBusy(false)
    }
  }

  function applyImapPreset(host: string, port: number) {
    setImapForm((f) => ({ ...f, host, port: String(port) }))
  }

  async function handleConnectImap() {
    if (!imapForm.email || !imapForm.host || !imapForm.port || !imapForm.password) {
      toast.error('Completá correo, servidor, puerto y contraseña.')
      return
    }
    setImapBusy(true)
    try {
      await connectImap({
        email: imapForm.email,
        host: imapForm.host,
        port: Number(imapForm.port),
        password: imapForm.password,
      })
      toast.success('Correo conectado — el sync ya está activo.')
      if (user) setImapStatus(await fetchImapSyncStatus(user.uid))
      setImapForm({ email: '', host: IMAP_PROVIDER_PRESETS[0].host, port: String(IMAP_PROVIDER_PRESETS[0].port), password: '' })
      setImapFormOpen(false)
      setImapAdvancedOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo conectar.')
    } finally {
      setImapBusy(false)
    }
  }

  async function handleDisconnectImap() {
    setImapBusy(true)
    try {
      await disconnectImap()
      setImapStatus({ connected: false, email: '' })
      toast.success('Correo desconectado.')
    } catch {
      toast.error('No se pudo desconectar.')
    } finally {
      setImapBusy(false)
    }
  }

  async function handleEnable() {
    setRequesting(true)
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted' && user) {
        const token = await registerPushToken(user.uid)
        setPushRegistered(Boolean(token))
      }
    } catch {
      // Nothing actionable if the browser rejects the request.
    } finally {
      setPermission(readPermission())
      setRequesting(false)
      // The user just made a deliberate choice here — don't also pop the
      // inline banner on the overview page right after.
      try {
        localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, '1')
      } catch {
        // Storage unavailable — harmless, the banner logic degrades safely.
      }
    }
  }

  function handleTest() {
    scheduleLocalReminder('StarkLab', 'Así se ve un recordatorio — todo funcionando.', 0)
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">Cuenta</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5">
            <span className="grid size-9 place-items-center rounded-xl bg-tasks/12">
              <User className="size-4 text-tasks" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Nombre</p>
              <p className="truncate text-sm font-medium">{user?.displayName ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5">
            <span className="grid size-9 place-items-center rounded-xl bg-tasks/12">
              <Mail className="size-4 text-tasks" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Correo</p>
              <p className="truncate text-sm font-medium">{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-finance/12">
            {gmailStatus?.connected ? (
              <MailCheck className="size-4.5 text-finance" aria-hidden="true" />
            ) : (
              <Mail className="size-4.5 text-finance" aria-hidden="true" />
            )}
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Sync de Banco Guayaquil</h2>
            <p className="text-sm text-muted-foreground">
              Conectá tu Gmail para registrar movimientos automáticamente
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Detecta los correos de consumo/orden de Banco Guayaquil y crea el movimiento por vos, sin que
          tengas la app abierta. Solo lee esos correos puntuales para detectar montos — nunca accede al
          resto de tu bandeja.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {gmailStatus?.connected ? (
            <>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-finance/12 px-3 text-[13px] font-medium text-finance">
                <MailCheck className="size-4" aria-hidden="true" />
                Conectado como {gmailStatus.email}
              </span>
              <button
                type="button"
                onClick={handleDisconnectGmail}
                disabled={gmailBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-60"
              >
                {gmailBusy ? 'Desconectando…' : 'Desconectar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={gmailBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-finance px-4 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60"
            >
              <Mail className="size-4" aria-hidden="true" />
              {gmailBusy ? 'Redirigiendo…' : 'Conectar Gmail'}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-tasks/12">
            <Inbox className="size-4.5 text-tasks" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Correo general (IMAP)</h2>
            <p className="text-sm text-muted-foreground">
              Cualquier proveedor — Outlook, Yahoo, iCloud, u otra cuenta de Gmail
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Alternativa a Gmail sin pantalla de consentimiento de Google: conectá cualquier correo con
          una <strong className="text-foreground">contraseña de aplicación</strong> (se genera desde la
          configuración de seguridad de tu proveedor, no es tu contraseña normal). Se guarda cifrada.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {imapStatus?.connected ? (
            <>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-tasks/12 px-3 text-[13px] font-medium text-tasks">
                <MailCheck className="size-4" aria-hidden="true" />
                Conectado como {imapStatus.email}
              </span>
              <button
                type="button"
                onClick={handleDisconnectImap}
                disabled={imapBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-60"
              >
                {imapBusy ? 'Desconectando…' : 'Desconectar'}
              </button>
            </>
          ) : !imapFormOpen ? (
            <button
              type="button"
              onClick={() => setImapFormOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-tasks px-4 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
            >
              <Inbox className="size-4" aria-hidden="true" />
              Conectar correo
            </button>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <div>
                <Label className="mb-1.5 block">Proveedor</Label>
                <div className="flex flex-wrap gap-2">
                  {IMAP_PROVIDER_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        applyImapPreset(preset.host, preset.port)
                        setImapAdvancedOpen(false)
                      }}
                      className={`h-8 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                        imapForm.host === preset.host && !imapAdvancedOpen
                          ? 'bg-tasks/15 text-tasks'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setImapAdvancedOpen(true)}
                    className={`h-8 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                      imapAdvancedOpen
                        ? 'bg-tasks/15 text-tasks'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Otro proveedor
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="imap-email">Correo</Label>
                  <Input
                    id="imap-email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={imapForm.email}
                    onChange={(e) => setImapForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="imap-password">Contraseña de aplicación</Label>
                  <Input
                    id="imap-password"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={imapForm.password}
                    onChange={(e) => setImapForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    No es tu contraseña normal — se genera aparte, en la configuración de seguridad de tu
                    proveedor.
                  </p>
                </div>

                {imapAdvancedOpen && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/40 p-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="imap-host">Servidor IMAP</Label>
                      <Input
                        id="imap-host"
                        placeholder="imap.ejemplo.com"
                        value={imapForm.host}
                        onChange={(e) => setImapForm((f) => ({ ...f, host: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="imap-port">Puerto</Label>
                      <Input
                        id="imap-port"
                        type="number"
                        value={imapForm.port}
                        onChange={(e) => setImapForm((f) => ({ ...f, port: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleConnectImap} disabled={imapBusy} size="sm">
                  {imapBusy ? 'Conectando…' : 'Conectar'}
                </Button>
                <Button onClick={() => setImapFormOpen(false)} disabled={imapBusy} size="sm" variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-water/12">
            <Bell className="size-4.5 text-water" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Notificaciones</h2>
            <p className="text-sm text-muted-foreground">Recordatorios de agua y entrenamientos</p>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Avisos por cada movimiento que detecta el sync del banco, además de recordatorios mientras la
          app está abierta. Llegan aunque StarkLab esté cerrado.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {permission === 'unsupported' && (
            <p className="text-[13px] text-muted-foreground">Tu navegador no soporta notificaciones.</p>
          )}

          {permission === 'default' && (
            <button
              type="button"
              onClick={handleEnable}
              disabled={requesting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-water px-4 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60"
            >
              <Bell className="size-4" aria-hidden="true" />
              {requesting ? 'Solicitando…' : 'Activar notificaciones'}
            </button>
          )}

          {permission === 'granted' && (
            <>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-finance/12 px-3 text-[13px] font-medium text-finance">
                <BellRing className="size-4" aria-hidden="true" />
                Activadas
              </span>
              <button
                type="button"
                onClick={handleTest}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70"
              >
                {testSent ? 'Enviada ✓' : 'Probar notificación'}
              </button>
              {pushRegistered === false && (
                <p className="w-full text-[12px] leading-relaxed text-muted-foreground">
                  El aviso local funciona, pero el push en segundo plano no se pudo activar — probablemente
                  falta configurar <code className="font-mono">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>.
                </p>
              )}
            </>
          )}

          {permission === 'denied' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3.5">
              <BellOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Las bloqueaste en el navegador — StarkLab ya no puede volver a pedir permiso. Para
                reactivarlas, abrí la configuración del sitio en tu navegador (el ícono junto a la URL)
                y cambiá "Notificaciones" a Permitir.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
