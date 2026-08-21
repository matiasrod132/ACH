"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Calculator, Save, Sparkles, Target, User } from "lucide-react"
import { toast } from "sonner"
import {
  ACTIVITY_LEVELS,
  DEFAULT_NUTRITION_TARGETS,
  NUTRITION_GOALS,
  calculateBMR,
  calculateTDEE,
  fetchNutritionProfile,
  fetchNutritionTargets,
  fetchWeightEntries,
  saveNutritionProfile,
  saveNutritionTargets,
  type ActivityLevel,
  type NutritionGoal,
  type NutritionProfile,
  type NutritionTargets,
} from "@/lib/nutrition"
import { formatWeight, type WeightUnit } from "@/lib/units"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function NutritionGoals({ uid }: { uid: string }) {
  const { data: targets, mutate: mutateTargets } = useSWR(["nutritionTargets", uid], () => fetchNutritionTargets(uid))
  const { data: profile, mutate: mutateProfile } = useSWR(["nutritionProfile", uid], () => fetchNutritionProfile(uid))
  const { data: weightEntries } = useSWR(["weight", uid], () => fetchWeightEntries(uid))

  const [form, setForm] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS)
  const [savingTargets, setSavingTargets] = useState(false)

  const [sex, setSex] = useState<"male" | "female">("male")
  const [heightCm, setHeightCm] = useState("")
  const [birthYear, setBirthYear] = useState("")
  const [activity, setActivity] = useState<ActivityLevel>("moderate")
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg")
  const [goal, setGoal] = useState<NutritionGoal>("maintain")
  const [savingProfile, setSavingProfile] = useState(false)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<(NutritionTargets & { rationale: string }) | null>(null)

  useEffect(() => {
    if (targets) setForm(targets)
  }, [targets])

  useEffect(() => {
    if (!profile) return
    if (profile.sex) setSex(profile.sex)
    setHeightCm(profile.heightCm ? String(profile.heightCm) : "")
    setBirthYear(profile.birthYear ? String(profile.birthYear) : "")
    setActivity(profile.activityLevel)
    setWeightUnit(profile.weightUnit)
    setGoal(profile.goal)
  }, [profile])

  const latestWeight = useMemo(() => {
    const sorted = [...(weightEntries ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.weightKg ?? null
  }, [weightEntries])

  const calc = useMemo(() => {
    const h = Number.parseFloat(heightCm)
    const by = Number.parseInt(birthYear, 10)
    if (!latestWeight || !h || !by) return null
    const age = new Date().getFullYear() - by
    if (age <= 0 || age > 120) return null
    const bmr = calculateBMR(sex, latestWeight, h, age)
    const tdee = calculateTDEE(bmr, activity)
    return { bmr, tdee, age }
  }, [heightCm, birthYear, sex, activity, latestWeight])

  async function handleSaveTargets() {
    setSavingTargets(true)
    try {
      await saveNutritionTargets(uid, form)
      await mutateTargets(form, { revalidate: false })
      toast.success("Objetivos guardados")
    } catch {
      toast.error("No se pudo guardar")
    } finally {
      setSavingTargets(false)
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    const next: NutritionProfile = {
      sex,
      heightCm: Number.parseFloat(heightCm) || null,
      birthYear: Number.parseInt(birthYear, 10) || null,
      activityLevel: activity,
      weightUnit,
      goal,
    }
    try {
      await saveNutritionProfile(uid, next)
      await mutateProfile(next, { revalidate: false })
      toast.success("Perfil guardado")
    } catch {
      toast.error("No se pudo guardar")
    } finally {
      setSavingProfile(false)
    }
  }

  function applyCalorieTarget(kcal: number) {
    setForm((f) => ({ ...f, calories: kcal }))
    toast.success(`Meta calórica ajustada a ${kcal} kcal — recuerda guardar`)
  }

  async function handleGenerateAI() {
    if (!calc || latestWeight === null) return
    setAiLoading(true)
    setAiError(null)
    setAiSuggestion(null)
    try {
      const res = await fetch("/api/nutrition-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex,
          weightKg: latestWeight,
          heightCm: Number.parseFloat(heightCm),
          age: calc.age,
          activityLevel: activity,
          goal,
          bmr: calc.bmr,
          tdee: calc.tdee,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar el plan")
      setAiSuggestion(data)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "No se pudo generar el plan")
    } finally {
      setAiLoading(false)
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return
    const { rationale: _rationale, ...targets } = aiSuggestion
    setForm(targets)
    toast.success("Sugerencia de IA aplicada — recuerda guardar objetivos")
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
            <Target className="size-5 text-nutrition" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Objetivos diarios</h2>
            <p className="text-sm text-muted-foreground">Metas de calorías, macros y agua.</p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["calories", "Calorías (kcal)"],
              ["protein", "Proteína (g)"],
              ["carbs", "Carbos (g)"],
              ["fat", "Grasa (g)"],
              ["water", "Agua (vasos)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={`target-${key}`}>{label}</Label>
              <Input
                id={`target-${key}`}
                type="number"
                min="0"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: Number.parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSaveTargets} disabled={savingTargets} className="mt-4 gap-1.5">
          <Save className="size-4" />
          {savingTargets ? "Guardando..." : "Guardar objetivos"}
        </Button>
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
            <User className="size-5 text-nutrition" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Tu perfil</h2>
            <p className="text-sm text-muted-foreground">Se usa para calcular tu gasto calórico (BMR/TDEE) e IMC.</p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-sex">Sexo</Label>
            <Select value={sex} onValueChange={(v) => setSex((v as "male" | "female") ?? "male")}>
              <SelectTrigger id="profile-sex">
                <SelectValue placeholder="Sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Hombre</SelectItem>
                <SelectItem value="female">Mujer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-height">Estatura (cm)</Label>
            <Input id="profile-height" type="number" min="0" placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-birth">Año de nacimiento</Label>
            <Input
              id="profile-birth"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              placeholder="1998"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="profile-activity">Actividad</Label>
            <Select value={activity} onValueChange={(v) => setActivity((v as ActivityLevel) ?? "moderate")}>
              <SelectTrigger id="profile-activity">
                <SelectValue placeholder="Actividad" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Unidad de peso</Label>
            <div className="flex rounded-lg border border-input bg-secondary/40 p-1">
              {(["kg", "lb"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setWeightUnit(u)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    weightUnit === u ? "bg-nutrition/15 text-nutrition" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-goal">Objetivo</Label>
            <Select value={goal} onValueChange={(v) => setGoal((v as NutritionGoal) ?? "maintain")}>
              <SelectTrigger id="profile-goal">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                {NUTRITION_GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleSaveProfile} disabled={savingProfile} variant="outline" className="mt-4 gap-1.5">
          <Save className="size-4" />
          {savingProfile ? "Guardando..." : "Guardar perfil"}
        </Button>

        <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Calculator className="size-4 text-nutrition" aria-hidden="true" />
            <span className="text-sm font-medium">Calculadora BMR / TDEE</span>
          </div>
          {calc ? (
            <>
              <p className="text-sm text-muted-foreground">
                Con {latestWeight !== null ? formatWeight(latestWeight, weightUnit) : "—"}, {heightCm} cm y{" "}
                {calc.age} años: tu metabolismo basal (BMR) es{" "}
                <span className="font-mono font-semibold tabular-nums text-foreground">{calc.bmr} kcal</span> y tu gasto total diario
                (TDEE) estimado es <span className="font-mono font-semibold tabular-nums text-foreground">{calc.tdee} kcal</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => applyCalorieTarget(calc.tdee - 500)}>
                  Bajar de peso ({calc.tdee - 500} kcal)
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyCalorieTarget(calc.tdee)}>
                  Mantener ({calc.tdee} kcal)
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyCalorieTarget(calc.tdee + 300)}>
                  Subir de peso ({calc.tdee + 300} kcal)
                </Button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-nutrition" aria-hidden="true" />
                  <span className="text-sm font-medium">Plan personalizado con IA</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Calorías, macros y meta de agua sugeridas por IA a partir de tu perfil y objetivo — no
                  solo el ajuste calórico de arriba.
                </p>

                <Button size="sm" onClick={handleGenerateAI} disabled={aiLoading} className="mt-3 gap-1.5">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {aiLoading ? "Generando..." : "Generar con IA"}
                </Button>

                {aiError && (
                  <p className="mt-3 rounded-lg bg-destructive/12 px-3 py-2 text-sm text-destructive">{aiError}</p>
                )}

                {aiSuggestion && (
                  <div className="mt-3 rounded-xl bg-nutrition/8 p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {(
                        [
                          ["calories", "Calorías"],
                          ["protein", "Proteína"],
                          ["carbs", "Carbos"],
                          ["fat", "Grasa"],
                          ["water", "Agua"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {aiSuggestion[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{aiSuggestion.rationale}</p>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Sugerencia generada por IA — no reemplaza el consejo de un profesional de la salud.
                    </p>
                    <Button size="sm" variant="outline" onClick={applyAiSuggestion} className="mt-3">
                      Aplicar a mis objetivos
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Completa tu sexo, estatura, año de nacimiento y registra al menos un peso en la pestaña Peso para
              calcular tu gasto calórico.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
