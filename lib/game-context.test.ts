import { describe, expect, it } from "vitest"
import { xpToNext, computeLevel } from "./game-context"

describe("xpToNext", () => {
  it("returns the base requirement for level 1", () => {
    expect(xpToNext(1)).toBe(100)
  })

  it("increases linearly by 60 xp per level", () => {
    expect(xpToNext(2)).toBe(160)
    expect(xpToNext(3)).toBe(220)
    expect(xpToNext(10)).toBe(100 + 9 * 60)
  })
})

describe("computeLevel", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(computeLevel(0)).toEqual({ level: 1, xpInLevel: 0, xpForLevel: 100 })
  })

  it("stays at level 1 just below the level-2 boundary", () => {
    expect(computeLevel(99)).toEqual({ level: 1, xpInLevel: 99, xpForLevel: 100 })
  })

  it("levels up exactly at the xp boundary reported by xpToNext", () => {
    // xpToNext(1) === 100, so totalXp === 100 should tip over into level 2
    expect(computeLevel(xpToNext(1))).toEqual({ level: 2, xpInLevel: 0, xpForLevel: xpToNext(2) })
  })

  it("stays at level 2 just below the level-3 boundary", () => {
    // 100 (level 1) + 159 (just under xpToNext(2)=160)
    expect(computeLevel(259)).toEqual({ level: 2, xpInLevel: 159, xpForLevel: 160 })
  })

  it("computes a mid-range level and round-trips against xpToNext", () => {
    // Cumulative xp to clear levels 1-4: 100 + 160 + 220 + 280 = 760
    const cumulativeThroughLevel4 = xpToNext(1) + xpToNext(2) + xpToNext(3) + xpToNext(4)
    expect(computeLevel(cumulativeThroughLevel4)).toEqual({
      level: 5,
      xpInLevel: 0,
      xpForLevel: xpToNext(5),
    })

    // One xp short of that boundary should still be level 4, with xpInLevel
    // one below xpForLevel (== xpToNext(4)).
    const result = computeLevel(cumulativeThroughLevel4 - 1)
    expect(result.level).toBe(4)
    expect(result.xpForLevel).toBe(xpToNext(4))
    expect(result.xpInLevel).toBe(result.xpForLevel - 1)
  })
})
