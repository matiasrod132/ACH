"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { findExerciseByName, exerciseImageUrl, gymVisualImageUrl } from "@/lib/gym"

interface ExerciseImageProps {
  exerciseName: string
  className?: string
}

/** Demo image for an exercise. Prefers the illustrated GymVisual GIF (already animated); falls back to a hover/tap frame-swap photo from free-exercise-db, then a placeholder. */
export function ExerciseImage({ exerciseName, className = "size-12 rounded-lg" }: ExerciseImageProps) {
  const [frame, setFrame] = useState<0 | 1>(0)
  const def = findExerciseByName(exerciseName)

  if (def?.gymVisualPath) {
    return (
      <img
        src={gymVisualImageUrl(def.gymVisualPath)}
        alt={`Demostración de ${exerciseName}`}
        className={`shrink-0 bg-secondary/60 object-cover ${className}`}
        loading="lazy"
      />
    )
  }

  if (!def?.datasetId) {
    return (
      <div className={`grid shrink-0 place-items-center bg-secondary/60 text-muted-foreground ${className}`}>
        <ImageOff className="size-4" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={exerciseImageUrl(def.datasetId, frame)}
      alt={`Demostración de ${exerciseName}`}
      className={`shrink-0 bg-secondary/60 object-cover ${className}`}
      loading="lazy"
      onMouseEnter={() => setFrame(1)}
      onMouseLeave={() => setFrame(0)}
      onTouchStart={() => setFrame((f) => (f === 0 ? 1 : 0))}
    />
  )
}
