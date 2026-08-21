import { describe, expect, it } from "vitest"
import { calculateBMR, calculateTDEE, calculateBMI, bmiCategory } from "./nutrition"

describe("calculateBMR (Mifflin-St Jeor)", () => {
  it("computes BMR for an adult male", () => {
    // base = 10*80 + 6.25*180 - 5*30 = 800 + 1125 - 150 = 1775; male: +5
    expect(calculateBMR("male", 80, 180, 30)).toBe(1780)
  })

  it("computes BMR for an adult female", () => {
    // base = 10*65 + 6.25*165 - 5*25 = 650 + 1031.25 - 125 = 1556.25; female: -161
    expect(calculateBMR("female", 65, 165, 25)).toBe(1395)
  })

  it("computes BMR for an older, lighter individual", () => {
    // base = 10*55 + 6.25*160 - 5*60 = 550 + 1000 - 300 = 1250; female: -161 = 1089
    expect(calculateBMR("female", 55, 160, 60)).toBe(1089)
  })
})

describe("calculateTDEE", () => {
  it("applies the sedentary multiplier", () => {
    expect(calculateTDEE(1395, "sedentary")).toBe(Math.round(1395 * 1.2))
  })

  it("applies the moderate multiplier", () => {
    expect(calculateTDEE(1780, "moderate")).toBe(2759)
  })

  it("applies the very_active multiplier", () => {
    expect(calculateTDEE(2000, "very_active")).toBe(Math.round(2000 * 1.9))
  })
})

describe("calculateBMI", () => {
  it("computes BMI for realistic weight/height", () => {
    // 70 / 1.75^2 = 22.857... -> rounded to 1 decimal
    expect(calculateBMI(70, 175)).toBe(22.9)
  })

  it("computes BMI for a different realistic weight/height", () => {
    // 55 / 1.60^2 = 21.484... -> rounded to 1 decimal
    expect(calculateBMI(55, 160)).toBe(21.5)
  })

  it("returns 0 for a non-positive height (guards against divide-by-zero)", () => {
    expect(calculateBMI(70, 0)).toBe(0)
    expect(calculateBMI(70, -10)).toBe(0)
  })
})

describe("bmiCategory", () => {
  it("returns the placeholder for non-positive BMI", () => {
    expect(bmiCategory(0)).toBe("—")
    expect(bmiCategory(-5)).toBe("—")
  })

  it("classifies just under the 'bajo peso' boundary", () => {
    expect(bmiCategory(18.4)).toBe("Bajo peso")
  })

  it("classifies exactly at the 'peso saludable' lower boundary", () => {
    expect(bmiCategory(18.5)).toBe("Peso saludable")
  })

  it("classifies just under the 'sobrepeso' boundary", () => {
    expect(bmiCategory(24.9)).toBe("Peso saludable")
  })

  it("classifies exactly at the 'sobrepeso' boundary", () => {
    expect(bmiCategory(25)).toBe("Sobrepeso")
  })

  it("classifies just under the 'obesidad' boundary", () => {
    expect(bmiCategory(29.9)).toBe("Sobrepeso")
  })

  it("classifies exactly at the 'obesidad' boundary", () => {
    expect(bmiCategory(30)).toBe("Obesidad")
  })

  it("classifies well above the 'obesidad' boundary", () => {
    expect(bmiCategory(40)).toBe("Obesidad")
  })
})
