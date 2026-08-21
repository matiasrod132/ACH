export type WeightUnit = "kg" | "lb"

const KG_TO_LB = 2.2046226218

export function kgToLb(kg: number): number {
  return kg * KG_TO_LB
}

export function lbToKg(lb: number): number {
  return lb / KG_TO_LB
}

/** Converts a canonical kg value to the given unit for display, rounded to 1 decimal. */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  const value = unit === "lb" ? kgToLb(kg) : kg
  return Math.round(value * 10) / 10
}

/** Converts a user-entered value in the given unit back to canonical kg for storage. */
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  const kg = unit === "lb" ? lbToKg(value) : value
  return Math.round(kg * 100) / 100
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${toDisplayWeight(kg, unit)} ${unit}`
}

/** Reasonable input step per unit: 0.5kg plates vs. whole-lb increments. */
export function weightStep(unit: WeightUnit): string {
  return unit === "lb" ? "1" : "0.5"
}
