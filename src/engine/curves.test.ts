import { DEFAULT_ADJUSTMENTS, type Adjustments, type CurvePoint } from './adjustments'
import { buildCurveLut, evaluateCurve, evaluateParametric } from './curves'

function withAdjustments(patch: Partial<Adjustments>): Adjustments {
  return { ...DEFAULT_ADJUSTMENTS, ...patch }
}

// 固定種子的亂數，測試結果才穩定
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

describe('evaluateCurve', () => {
  const points: CurvePoint[] = [
    [0, 10],
    [64, 40],
    [128, 200],
    [200, 180],
    [255, 255],
  ]

  it('passes through the given points', () => {
    for (const [x, y] of points) expect(evaluateCurve(points, x)).toBeCloseTo(y, 6)
  })

  it('is flat outside the endpoint range', () => {
    const inner: CurvePoint[] = [
      [30, 50],
      [220, 190],
    ]
    expect(evaluateCurve(inner, 0)).toBe(50)
    expect(evaluateCurve(inner, 10)).toBe(50)
    expect(evaluateCurve(inner, 240)).toBe(190)
    expect(evaluateCurve(inner, 255)).toBe(190)
  })

  it('does not overshoot between points', () => {
    for (let x = 0; x <= 255; x++) {
      const y = evaluateCurve(points, x)
      const i = points.findIndex((_, k) => x <= points[k + 1]?.[0])
      const [a, b] = [points[i][1], points[i + 1][1]]
      expect(y).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-6)
      expect(y).toBeLessThanOrEqual(Math.max(a, b) + 1e-6)
    }
  })

  it('is the identity for the default curve', () => {
    for (let x = 0; x <= 255; x += 5) expect(evaluateCurve(DEFAULT_ADJUSTMENTS.curve.rgb, x)).toBeCloseTo(x, 6)
  })
})

describe('evaluateParametric', () => {
  it('is the identity at defaults', () => {
    for (let x = 0; x <= 1; x += 0.05) expect(evaluateParametric(DEFAULT_ADJUSTMENTS, x)).toBeCloseTo(x, 6)
  })

  it('raises the low end more than the high end for +shadows', () => {
    const adj = withAdjustments({ curveShadows: 100 })
    const low = evaluateParametric(adj, 0.15) - 0.15
    const high = evaluateParametric(adj, 0.85) - 0.85
    expect(low).toBeGreaterThan(0.05)
    expect(low).toBeGreaterThan(high)
  })

  it('lowers the top for -highlights', () => {
    const adj = withAdjustments({ curveHighlights: -100 })
    expect(evaluateParametric(adj, 0.9)).toBeLessThan(0.85)
    expect(evaluateParametric(adj, 1)).toBe(1)
  })

  it('moves the region with its split point', () => {
    const narrow = withAdjustments({ curveShadows: 100, curveShadowSplit: 10 })
    const wide = withAdjustments({ curveShadows: 100, curveShadowSplit: 40 })
    // 分界點往右移，陰影區變寬，中間偏暗的地方受影響更多
    expect(evaluateParametric(wide, 0.3)).toBeGreaterThan(evaluateParametric(narrow, 0.3))
  })

  it('stays monotonic and within 0..1 for extreme settings', () => {
    const next = random(42)
    const pick = (min: number, max: number) => Math.round(min + next() * (max - min))
    for (let n = 0; n < 200; n++) {
      const adj = withAdjustments({
        curveShadows: next() < 0.5 ? -100 : 100,
        curveDarks: pick(-100, 100),
        curveLights: pick(-100, 100),
        curveHighlights: next() < 0.5 ? -100 : 100,
        curveShadowSplit: pick(10, 40),
        curveMidtoneSplit: pick(41, 59),
        curveHighlightSplit: pick(60, 90),
      })
      let previous = -Infinity
      for (let i = 0; i <= 200; i++) {
        const y = evaluateParametric(adj, i / 200)
        expect(y).toBeGreaterThanOrEqual(previous - 1e-9)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
        previous = y
      }
    }
  })
})

describe('buildCurveLut', () => {
  it('is the identity for every row at defaults', () => {
    const size = 256
    const lut = buildCurveLut(DEFAULT_ADJUSTMENTS, size)
    expect(lut.length).toBe(size * 4)
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < size; i++) expect(lut[row * size + i]).toBeCloseTo(i / (size - 1), 5)
    }
  })

  it('applies the rgb curve after the parametric curve in the master row', () => {
    const rgb: CurvePoint[] = [
      [0, 0],
      [128, 180],
      [255, 255],
    ]
    const adj = withAdjustments({ curveDarks: 60, curve: { ...DEFAULT_ADJUSTMENTS.curve, rgb } })
    const size = 1024
    const lut = buildCurveLut(adj, size)
    const i = 300
    const x = i / (size - 1)
    expect(lut[i]).toBeCloseTo(evaluateCurve(rgb, evaluateParametric(adj, x) * 255) / 255, 5)
  })

  it('puts the red, green and blue curves in rows 1 to 3', () => {
    const red: CurvePoint[] = [
      [0, 40],
      [255, 255],
    ]
    const blue: CurvePoint[] = [
      [0, 0],
      [255, 200],
    ]
    const adj = withAdjustments({ curve: { ...DEFAULT_ADJUSTMENTS.curve, red, blue } })
    const size = 256
    const lut = buildCurveLut(adj, size)
    expect(lut[size]).toBeCloseTo(40 / 255, 5)
    expect(lut[2 * size]).toBeCloseTo(0, 5)
    expect(lut[4 * size - 1]).toBeCloseTo(200 / 255, 5)
    expect(lut[size - 1]).toBeCloseTo(1, 5)
  })
})
