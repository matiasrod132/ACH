'use client'

import { useState, type FormEvent } from 'react'
import { Zap, Loader2, Trophy, Flame, Droplet, Sparkles } from 'lucide-react'
import { useGame } from '@/lib/game-context'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { signIn, register } = useGame()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await register(name, email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        {/* Brand / pitch side — always visible (not just on desktop): this is
            the app's name + purpose statement, and hiding it below the `lg`
            breakpoint meant a mobile-width render (including automated
            checks like Google's OAuth brand verification) saw only the logo
            with no description at all. */}
        <section className="flex flex-col gap-6 lg:gap-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-neon-indigo/15">
              <Zap className="size-6 text-neon-indigo" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">StarkLab</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl lg:text-5xl lg:leading-[1.05]">
              Convierte tus hábitos en <span className="text-gradient">un juego que ganas</span>.
            </h1>
            <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              {'Olvídate de las hojas de cálculo — esto hace que lo demás parezca basura. '}
              Gana XP, sube de nivel y construye rachas imparables en todo lo que te importa.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            <FeatureRow icon={<Trophy className="size-4 text-neon-indigo" />} label="Sube de nivel con cada tarea completada" />
            <FeatureRow icon={<Flame className="size-4 text-neon-emerald" />} label="Controla tus hábitos y rachas diarias" />
            <FeatureRow icon={<Droplet className="size-4 text-neon-blue" />} label="Monitores de hidratación y gastos incluidos" />
          </ul>
        </section>

        {/* Form side */}
        <section className="glass glow-indigo mx-auto w-full max-w-md rounded-3xl p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-1 rounded-xl bg-secondary/60 p-1">
            <TabButton active={mode === 'login'} onClick={() => setMode('login')}>
              Iniciar sesión
            </TabButton>
            <TabButton active={mode === 'register'} onClick={() => setMode('register')}>
              Crear cuenta
            </TabButton>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {mode === 'login' ? 'Bienvenido de nuevo' : 'Comienza tu partida'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Inicia sesión para continuar tu racha.'
                : 'Crea una cuenta y reclama tu primer XP.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {mode === 'register' && (
              <Field
                id="name"
                label="Nombre para mostrar"
                type="text"
                placeholder="Tony Stark"
                value={name}
                onChange={setName}
                required
                autoComplete="name"
              />
            )}
            <Field
              id="email"
              label="Correo electrónico"
              type="email"
              placeholder="tu@starklab.gg"
              value={email}
              onChange={setEmail}
              required
              autoComplete="email"
            />
            <Field
              id="password"
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {error && (
              <p role="alert" className="rounded-lg bg-destructive/12 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neon-indigo font-medium text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {mode === 'login' ? 'Iniciando sesión…' : 'Creando…'}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  {mode === 'login' ? 'Entrar a StarkLab' : 'Crear cuenta'}
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="grid size-8 place-items-center rounded-lg bg-secondary/70 ring-1 ring-border">
        {icon}
      </span>
      {label}
    </li>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-1 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  id: string
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="h-11 rounded-xl border border-input bg-secondary/40 px-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-neon-indigo/60 focus:bg-secondary/60 focus:ring-4 focus:ring-neon-indigo/15"
      />
    </div>
  )
}
