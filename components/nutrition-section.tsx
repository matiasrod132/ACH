"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Flame, Beef, Wheat, Droplet, LayoutGrid, Utensils, Scale, Target, Trophy } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { useGame } from "@/lib/game-context"
import { fetchMeals, fetchNutritionTargets, fetchWaterHistory } from "@/lib/nutrition"
import { todayISO, parseISODate, dateToISO } from "@/lib/format"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WaterWidget } from "@/components/water-widget"
import { NutritionMeals } from "@/components/nutrition-meals"
import { NutritionWeight } from "@/components/nutrition-weight"
import { NutritionGoals } from "@/components/nutrition-goals"

type PageTab = "resumen" | "comidas" | "peso" | "objetivos"

function MacroBar({
  label,
  value,
  target,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  target: number
  color: string
  icon: typeof Beef
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        <Icon className="size-4" style={{ color }} aria-hidden="true" />
        <span className="flex-1 font-medium">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {value}g / {target}g
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export function NutritionSection() {
  const { user } = useGame()
  const uid = user!.uid
  const [pageTab, setPageTab] = useState<PageTab>("resumen")

  const { data: mealsData } = useSWR(["meals", uid], () => fetchMeals(uid))
  const { data: targets } = useSWR(["nutritionTargets", uid], () => fetchNutritionTargets(uid))
  const { data: waterHistory } = useSWR(["waterHistory", uid], () => fetchWaterHistory(uid))

  const meals = mealsData ?? []
  const today = todayISO()
  const targetValues = targets ?? { calories: 2200, protein: 140, carbs: 250, fat: 70, water: 8 }

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today])
  const todayTotals = useMemo(
    () =>
      todayMeals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [todayMeals],
  )

  const caloriePct = Math.min(100, Math.round((todayTotals.calories / targetValues.calories) * 100) || 0)
  const calorieGauge = [{ name: "calories", value: caloriePct, fill: "var(--color-chart-1)" }]
  const calorieComplete = todayTotals.calories >= targetValues.calories

  const macroPie = [
    { key: "protein", label: "Proteína", grams: todayTotals.protein, fill: "var(--color-chart-1)" },
    { key: "carbs", label: "Carbos", grams: todayTotals.carbs, fill: "var(--color-chart-2)" },
    { key: "fat", label: "Grasa", grams: todayTotals.fat, fill: "var(--color-chart-4)" },
  ].filter((m) => m.grams > 0)

  const weekData = useMemo(() => {
    const buckets: { label: string; calories: number; water: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = dateToISO(d)
      const dayCalories = meals.filter((m) => m.date === iso).reduce((s, m) => s + m.calories, 0)
      const dayWater = waterHistory?.find((w) => w.date === iso)?.cups ?? 0
      buckets.push({
        label: parseISODate(iso).toLocaleDateString("es", { weekday: "short" }),
        calories: dayCalories,
        water: dayWater,
      })
    }
    return buckets
  }, [meals, waterHistory])

  const calorieConfig: ChartConfig = { calories: { label: "Calorías", color: "var(--chart-1)" } }
  const waterConfig: ChartConfig = { water: { label: "Vasos", color: "var(--chart-2)" } }
  const macroConfig: ChartConfig = {
    protein: { label: "Proteína", color: "var(--chart-1)" },
    carbs: { label: "Carbos", color: "var(--chart-2)" },
    fat: { label: "Grasa", color: "var(--chart-4)" },
  }

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as PageTab)}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="resumen" className="gap-1.5">
            <LayoutGrid className="size-4" aria-hidden="true" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="comidas" className="gap-1.5">
            <Utensils className="size-4" aria-hidden="true" />
            Comidas
          </TabsTrigger>
          <TabsTrigger value="peso" className="gap-1.5">
            <Scale className="size-4" aria-hidden="true" />
            Peso
          </TabsTrigger>
          <TabsTrigger value="objetivos" className="gap-1.5">
            <Target className="size-4" aria-hidden="true" />
            Objetivos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === "resumen" && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="glass rounded-3xl p-5 sm:p-6">
              <header className="mb-3 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
                  <Flame className="size-5 text-nutrition" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Calorías hoy</h2>
                  <p className="text-sm text-muted-foreground">Meta {targetValues.calories} kcal</p>
                </div>
              </header>
              <div className="relative">
                <ChartContainer config={calorieConfig} className="mx-auto aspect-square h-52">
                  <RadialBarChart
                    data={calorieGauge}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={72}
                    outerRadius={104}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={12} background />
                  </RadialBarChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-bold tabular-nums">{todayTotals.calories}</span>
                  <span className="text-xs text-muted-foreground">/ {targetValues.calories} kcal</span>
                  {calorieComplete && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-nutrition/15 px-2 py-0.5 text-[11px] font-medium text-nutrition">
                      <Trophy className="size-3" aria-hidden="true" /> Meta cumplida
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="glass rounded-3xl p-5 sm:p-6">
              <header className="mb-4 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
                  <Beef className="size-5 text-nutrition" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Macros</h2>
                  <p className="text-sm text-muted-foreground">Gramos vs. meta diaria</p>
                </div>
              </header>
              <div className="flex items-center gap-4">
                {macroPie.length > 0 ? (
                  <ChartContainer config={macroConfig} className="aspect-square h-36 shrink-0">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                      <Pie data={macroPie} dataKey="grams" nameKey="label" innerRadius={38} strokeWidth={2}>
                        {macroPie.map((m) => (
                          <Cell key={m.key} fill={m.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="grid aspect-square h-36 shrink-0 place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                    Sin comidas
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3">
                  <MacroBar label="Proteína" value={todayTotals.protein} target={targetValues.protein} color="var(--color-chart-1)" icon={Beef} />
                  <MacroBar label="Carbos" value={todayTotals.carbs} target={targetValues.carbs} color="var(--color-chart-2)" icon={Wheat} />
                  <MacroBar label="Grasa" value={todayTotals.fat} target={targetValues.fat} color="var(--color-chart-4)" icon={Droplet} />
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="glass rounded-3xl p-5 sm:p-6">
              <header className="mb-4 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
                  <Flame className="size-5 text-nutrition" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Calorías esta semana</h2>
                  <p className="text-sm text-muted-foreground">Línea punteada = meta</p>
                </div>
              </header>
              <ChartContainer config={calorieConfig} className="aspect-[16/10] w-full">
                <BarChart data={weekData} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} width={36} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={targetValues.calories} stroke="var(--color-chart-3)" strokeDasharray="4 4" />
                  <Bar dataKey="calories" fill="var(--color-calories)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </section>

            <section className="glass rounded-3xl p-5 sm:p-6">
              <header className="mb-4 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-nutrition/12">
                  <Droplet className="size-5 text-nutrition" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Hidratación esta semana</h2>
                  <p className="text-sm text-muted-foreground">Vasos por día (meta {targetValues.water})</p>
                </div>
              </header>
              <ChartContainer config={waterConfig} className="aspect-[16/10] w-full">
                <BarChart data={weekData} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} width={28} fontSize={12} domain={[0, targetValues.water]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={targetValues.water} stroke="var(--color-chart-3)" strokeDasharray="4 4" />
                  <Bar dataKey="water" fill="var(--color-water)" radius={[6, 6, 0, 0]}>
                    {weekData.map((d, i) => (
                      <Cell key={i} fill={d.water >= targetValues.water ? "var(--color-chart-3)" : "var(--color-chart-2)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </section>
          </div>

          <div className="max-w-md">
            <WaterWidget />
          </div>
        </>
      )}

      {pageTab === "comidas" && <NutritionMeals uid={uid} />}
      {pageTab === "peso" && <NutritionWeight uid={uid} />}
      {pageTab === "objetivos" && <NutritionGoals uid={uid} />}
    </div>
  )
}
