'use client'

import { useGame } from '@/lib/game-context'
import { LevelBar } from '@/components/level-bar'
import { HobbiesCard } from '@/components/hobbies-card'
import { TaskChecklist } from '@/components/task-checklist'
import { ExpenseMonitor } from '@/components/expense-monitor'
import { WaterWidget } from '@/components/water-widget'
import { WeeklyRecap } from '@/components/weekly-recap'
import { InsightsPanel } from '@/components/insights-panel'

export default function OverviewPage() {
  const { user } = useGame()

  return (
    <>
      <LevelBar />
      {user && <WeeklyRecap uid={user.uid} />}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <HobbiesCard />
          <TaskChecklist />
        </div>
        <div className="flex flex-col gap-5">
          <WaterWidget />
          <ExpenseMonitor />
        </div>
      </div>
      {user && <InsightsPanel uid={user.uid} />}
    </>
  )
}
