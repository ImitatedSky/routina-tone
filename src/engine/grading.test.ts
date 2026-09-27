import { DEFAULT_ADJUSTMENTS } from './adjustments'
import { gradingUniforms, hueToRgb, mixerUniforms } from './grading'

describe('hueToRgb', () => {
  it('follows the HSV color wheel', () => {
    expect(hueToRgb(0)).toEqual([1, 0, 0])
    expect(hueToRgb(120)).toEqual([0, 1, 0])
    expect(hueToRgb(240)).toEqual([0, 0, 1])
    expect(hueToRgb(360)).toEqual([1, 0, 0])
  })
})

describe('gradingUniforms', () => {
  it('does nothing at the defaults', () => {
    const u = gradingUniforms(DEFAULT_ADJUSTMENTS)
    for (const v of [u.shadow, u.midtone, u.highlight, u.global]) {
      v.forEach((x) => expect(x).toBeCloseTo(0))
    }
    expect(u.pivot).toBe(0.5)
    expect(u.blend).toBe(0.5)
  })

  it('tints without changing luminance', () => {
    const u = gradingUniforms({ ...DEFAULT_ADJUSTMENTS, gradeShadowHue: 220, gradeShadowSat: 60 })
    const [r, g, b] = u.shadow
    expect(b).toBeGreaterThan(r)
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(0, 6)
  })

  it('moves the pivot toward the shadows for positive balance', () => {
    expect(gradingUniforms({ ...DEFAULT_ADJUSTMENTS, gradeBalance: 100 }).pivot).toBeLessThan(0.5)
  })
})

describe('mixerUniforms', () => {
  it('keeps the band order and scales to -1..1', () => {
    const u = mixerUniforms({ ...DEFAULT_ADJUSTMENTS, hueOrange: 50, lumMagenta: -100 })
    expect(u.hue[1]).toBe(0.5)
    expect(u.lum[7]).toBe(-1)
  })
})
