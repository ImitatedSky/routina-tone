import type { Adjustments, CurvePoint } from './adjustments'

// 參數式曲線滑桿 ±100 時，區域中心點上下移動的量（0..1 的比例）
const PARAMETRIC_STRENGTH = 0.12

// 單調三次插值（Fritsch–Carlson）：曲線不會超出相鄰控制點之間的範圍，
// 不像一般 spline 會在點附近鼓起來。回傳的函式在點的 x 範圍外保持端點的 y。
function monotoneCubic(points: CurvePoint[]): (x: number) => number {
  const n = points.length
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])

  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))

  const tangents: number[] = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1]
    const b = slopes[i]
    tangents.push(a * b <= 0 ? 0 : (a + b) / 2)
  }
  tangents.push(slopes[n - 2])

  // 切線太陡會過衝，依 Fritsch–Carlson 的條件縮小
  for (let i = 0; i < n - 1; i++) {
    const d = slopes[i]
    if (d === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
      continue
    }
    const a = tangents[i] / d
    const b = tangents[i + 1] / d
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      tangents[i] = t * a * d
      tangents[i + 1] = t * b * d
    }
  }

  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * tangents[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * tangents[i + 1]
    )
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function pointCurve(points: CurvePoint[]): (x: number) => number {
  const f = monotoneCubic(points)
  return (x) => clamp(f(x), 0, 255)
}

export function evaluateCurve(points: CurvePoint[], x: number): number {
  return pointCurve(points)(x)
}

// Lightroom 的區域曲線：四個區域的中心點依滑桿上下移動，頭尾固定在 (0,0)、(1,1)
export function parametricCurve(adj: Adjustments): (x: number) => number {
  const s1 = adj.curveShadowSplit / 100
  const s2 = adj.curveMidtoneSplit / 100
  const s3 = adj.curveHighlightSplit / 100
  const regions: [number, number][] = [
    [s1 / 2, adj.curveShadows],
    [(s1 + s2) / 2, adj.curveDarks],
    [(s2 + s3) / 2, adj.curveLights],
    [(s3 + 1) / 2, adj.curveHighlights],
  ]

  const points: CurvePoint[] = [[0, 0]]
  for (const [center, amount] of regions) {
    const y = clamp(center + (amount / 100) * PARAMETRIC_STRENGTH, 0, 1)
    // 往上拉的區域可能比右邊的區域還高，壓平讓整條曲線維持遞增
    points.push([center, Math.max(y, points[points.length - 1][1])])
  }
  points.push([1, 1])

  const f = monotoneCubic(points)
  return (x) => clamp(f(x), 0, 1)
}

export function evaluateParametric(adj: Adjustments, x: number): number {
  return parametricCurve(adj)(x)
}

// 給 shader 的查表：4 列，第 0 列是參數式曲線再套 RGB 點曲線，第 1..3 列是紅綠藍點曲線
export function buildCurveLut(adj: Adjustments, size = 1024): Float32Array {
  const lut = new Float32Array(size * 4)
  const parametric = parametricCurve(adj)
  const rows = [adj.curve.rgb, adj.curve.red, adj.curve.green, adj.curve.blue].map(pointCurve)

  for (let i = 0; i < size; i++) {
    const x = i / (size - 1)
    lut[i] = rows[0](parametric(x) * 255) / 255
    for (let row = 1; row < 4; row++) lut[row * size + i] = rows[row](x * 255) / 255
  }
  return lut
}
