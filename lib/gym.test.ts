import { describe, expect, it } from "vitest"
import {
  suggestNextLoad,
  computeExerciseRank,
  workoutVolume,
  workoutSetCount,
  type Workout,
  type SetLog,
} from "./gym"

function set(weightKg: number, reps: number, completed = true): SetLog {
  return { weightKg, reps, completed }
}

function workout(id: string, date: string, exerciseName: string, sets: SetLog[]): Workout {
  return {
    id,
    date,
    name: "Entrenamiento",
    routineId: null,
    exercises: [{ exerciseName, sets }],
    durationMin: null,
    notes: "",
    createdAt: null,
  }
}

describe("suggestNextLoad", () => {
  it("bumps weight and trims reps after a completed set at 10+ average reps (double progression)", () => {
    const workouts = [workout("w1", "2026-08-10", "Sentadilla", [set(20, 10), set(20, 10), set(20, 10)])]
    const suggestion = suggestNextLoad(workouts, "Sentadilla")
    // avgReps = 10 >= 10, bestSet.weightKg (20) >= 20 -> bump 2.5
    expect(suggestion).toEqual({
      weightKg: 22.5,
      reps: 8,
      basedOn: { date: "2026-08-10", weightKg: 20, reps: 10 },
    })
  })

  it("adds a rep target (same weight) when average reps are still below 10", () => {
    const workouts = [workout("w1", "2026-08-10", "Press de banca", [set(15, 8), set(15, 8), set(15, 8)])]
    const suggestion = suggestNextLoad(workouts, "Press de banca")
    expect(suggestion).toEqual({
      weightKg: 15,
      reps: 9,
      basedOn: { date: "2026-08-10", weightKg: 15, reps: 8 },
    })
  })

  it("uses a smaller 1kg bump for lighter loads under 20kg", () => {
    const workouts = [workout("w1", "2026-08-10", "Curl", [set(12, 10), set(12, 10)])]
    const suggestion = suggestNextLoad(workouts, "Curl")
    expect(suggestion?.weightKg).toBe(13)
    expect(suggestion?.reps).toBe(8)
  })

  it("returns null when the exercise was never logged", () => {
    const workouts = [workout("w1", "2026-08-10", "Sentadilla", [set(20, 10)])]
    expect(suggestNextLoad(workouts, "Peso muerto")).toBeNull()
  })

  it("returns null when the only sets logged are incomplete or invalid", () => {
    const workouts = [workout("w1", "2026-08-10", "Sentadilla", [set(20, 10, false), set(0, 10), set(20, 0)])]
    expect(suggestNextLoad(workouts, "Sentadilla")).toBeNull()
  })

  it("picks the most recent workout containing the exercise", () => {
    const workouts = [
      workout("w1", "2026-08-01", "Sentadilla", [set(18, 10)]),
      workout("w2", "2026-08-15", "Sentadilla", [set(20, 10)]),
    ]
    const suggestion = suggestNextLoad(workouts, "Sentadilla")
    expect(suggestion?.basedOn).toEqual({ date: "2026-08-15", weightKg: 20, reps: 10 })
  })
})

describe("computeExerciseRank", () => {
  it("returns null when the exercise has no valid completed sets", () => {
    expect(computeExerciseRank([], "Sentadilla")).toBeNull()
    const workouts = [workout("w1", "2026-08-01", "Sentadilla", [set(20, 10, false)])]
    expect(computeExerciseRank(workouts, "Sentadilla")).toBeNull()
  })

  it("stays Bronce with only one session logged (no improvement to measure yet)", () => {
    const workouts = [workout("w1", "2026-08-01", "Sentadilla", [set(20, 5)])]
    const info = computeExerciseRank(workouts, "Sentadilla")
    expect(info?.rank).toBe("Bronce")
    expect(info?.sessionsLogged).toBe(1)
    expect(info?.improvementPct).toBe(0)
  })

  it("reaches Plata with a couple of sessions and a modest PR improvement", () => {
    const workouts = [
      workout("w1", "2026-08-01", "Sentadilla", [set(10, 5)]), // est1RM ~11.7
      workout("w2", "2026-08-08", "Sentadilla", [set(12, 5)]), // est1RM 14.0, ~20% up
    ]
    const info = computeExerciseRank(workouts, "Sentadilla")
    expect(info?.rank).toBe("Plata")
    expect(info?.sessionsLogged).toBe(2)
  })

  it("climbs to Oro as PRs improve across more sessions", () => {
    const workouts = [
      workout("w1", "2026-08-01", "Sentadilla", [set(10, 5)]),
      workout("w2", "2026-08-08", "Sentadilla", [set(11, 5)]),
      workout("w3", "2026-08-15", "Sentadilla", [set(12, 5)]),
      workout("w4", "2026-08-22", "Sentadilla", [set(14, 5)]),
    ]
    const info = computeExerciseRank(workouts, "Sentadilla")
    expect(info?.sessionsLogged).toBe(4)
    expect(info?.rank).toBe("Oro")
    expect(info?.improvementPct).toBeGreaterThanOrEqual(15)
  })
})

describe("workoutVolume", () => {
  it("sums weight x reps across completed sets only", () => {
    const w: Workout = {
      id: "w1",
      date: "2026-08-01",
      name: "Full body",
      routineId: null,
      exercises: [
        { exerciseName: "Sentadilla", sets: [set(20, 10), set(20, 8), set(20, 6, false)] },
        { exerciseName: "Press de banca", sets: [set(15, 10)] },
      ],
      durationMin: 45,
      notes: "",
      createdAt: null,
    }
    // (20*10 + 20*8) + (15*10) = 360 + 150 = 510; the incomplete set is excluded
    expect(workoutVolume(w)).toBe(510)
  })

  it("returns 0 for a workout with no completed sets", () => {
    const w = workout("w1", "2026-08-01", "Sentadilla", [set(20, 10, false)])
    expect(workoutVolume(w)).toBe(0)
  })
})

describe("workoutSetCount", () => {
  it("counts only completed sets across all exercises", () => {
    const w: Workout = {
      id: "w1",
      date: "2026-08-01",
      name: "Full body",
      routineId: null,
      exercises: [
        { exerciseName: "Sentadilla", sets: [set(20, 10), set(20, 8), set(20, 6, false)] },
        { exerciseName: "Press de banca", sets: [set(15, 10), set(15, 10)] },
      ],
      durationMin: 45,
      notes: "",
      createdAt: null,
    }
    expect(workoutSetCount(w)).toBe(4)
  })

  it("returns 0 when there are no exercises", () => {
    const w: Workout = {
      id: "w1",
      date: "2026-08-01",
      name: "Empty",
      routineId: null,
      exercises: [],
      durationMin: null,
      notes: "",
      createdAt: null,
    }
    expect(workoutSetCount(w)).toBe(0)
  })
})
