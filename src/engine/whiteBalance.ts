// 白平衡：把色溫/色調滑桿換成一個線性 sRGB 的 3x3 矩陣，交給 shader 乘上去。
//
// JPEG 沒有原始的白點，所以滑桿是相對值（和 Lightroom 對 JPEG 的做法一樣）：
// 滑桿假設「拍攝時的光源」偏離了 D65，再用 Bradford 色適應把那個光源校正回 D65。
// 假設光源偏藍 → 校正後畫面變暖，所以色溫往右 = 變暖。

type Mat3 = number[] // row-major, 9 個數
type Vec3 = [number, number, number]

const SRGB_TO_XYZ: Mat3 = [
  0.4124564, 0.3575761, 0.1804375,
  0.2126729, 0.7151522, 0.072175,
  0.0193339, 0.119192, 0.9503041,
]
const XYZ_TO_SRGB: Mat3 = [
  3.2404542, -1.5371385, -0.4985314,
  -0.969266, 1.8760108, 0.041556,
  0.0556434, -0.2040259, 1.0572252,
]
const BRADFORD: Mat3 = [
  0.8951, 0.2664, -0.1614,
  -0.7502, 1.7135, 0.0367,
  0.0389, -0.0685, 1.0296,
]
const BRADFORD_INV: Mat3 = [
  0.9869929, -0.1470543, 0.1599627,
  0.4323053, 0.5183603, 0.0492912,
  -0.0085287, 0.0400428, 0.9684867,
]
const LUMA: Vec3 = [0.2126729, 0.7151522, 0.072175]

const D65_XY: [number, number] = [0.31271, 0.32902]
const D65_MIRED = 1e6 / 6504

// 滑桿每一格的偏移量。±100 大約是 4700K–10700K、Duv ±0.015
const MIRED_PER_STEP = 0.6
const DUV_PER_STEP = 0.00015

function mul(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c])
    }
  }
  return out
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

// 黑體輻射軌跡上的色度座標（Kim et al. 2002 的三次近似，1667K–25000K）
function planckianXY(kelvin: number): [number, number] {
  const t = Math.min(25000, Math.max(1667, kelvin))
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039
  let y: number
  if (t <= 2222) y = -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
  else if (t <= 4000) y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
  else y = 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483
  return [x, y]
}

// CIE 1960 UCS，色調（Duv）是在這個平面上垂直於軌跡的距離
function xyToUv([x, y]: [number, number]): [number, number] {
  const d = -2 * x + 12 * y + 3
  return [(4 * x) / d, (6 * y) / d]
}

function uvToXy([u, v]: [number, number]): [number, number] {
  const d = 2 * u - 8 * v + 4
  return [(3 * u) / d, (2 * v) / d]
}

function locusUv(mired: number): [number, number] {
  return xyToUv(planckianXY(1e6 / mired))
}

// 滑桿假設的拍攝光源，在 uv 平面上
function assumedWhiteUv(temp: number, tint: number): [number, number] {
  const mired = D65_MIRED - temp * MIRED_PER_STEP
  const [u0, v0] = locusUv(D65_MIRED)
  const [u1, v1] = locusUv(mired)
  // D65 不在軌跡正上方，所以只取「軌跡上的位移」加到 D65，滑桿歸零時才會剛好是 D65
  const [du, dv] = [u1 - u0, v1 - v0]

  // 軌跡的法向量，指向偏綠的那一側（v 較大）
  const [ua, va] = locusUv(mired - 1)
  const [ub, vb] = locusUv(mired + 1)
  const len = Math.hypot(ub - ua, vb - va)
  let [nu, nv] = [-(vb - va) / len, (ub - ua) / len]
  if (nv < 0) [nu, nv] = [-nu, -nv]

  // 色調往右 = 偏洋紅，等於假設光源偏綠
  const duv = tint * DUV_PER_STEP
  const [ud, vd] = xyToUv(D65_XY)
  return [ud + du + nu * duv, vd + dv + nv * duv]
}

function xyToXYZ([x, y]: [number, number]): Vec3 {
  return [x / y, 1, (1 - x - y) / y]
}

// 回傳 column-major 的 3x3（GLSL mat3 的排列）
export function whiteBalanceMatrix(temp: number, tint: number): Float32Array {
  const source = xyToXYZ(uvToXy(assumedWhiteUv(temp, tint)))
  const target = xyToXYZ(D65_XY)
  const [sr, sg, sb] = apply(BRADFORD, source)
  const [tr, tg, tb] = apply(BRADFORD, target)
  const scale: Mat3 = [tr / sr, 0, 0, 0, tg / sg, 0, 0, 0, tb / sb]
  const adapt = mul(BRADFORD_INV, mul(scale, BRADFORD))
  const m = mul(XYZ_TO_SRGB, mul(adapt, SRGB_TO_XYZ))

  // 保持灰色的亮度不變，調白平衡時畫面不會跟著變亮變暗
  const gray = apply(m, [1, 1, 1])
  const k = 1 / (LUMA[0] * gray[0] + LUMA[1] * gray[1] + LUMA[2] * gray[2])

  return new Float32Array([
    m[0] * k, m[3] * k, m[6] * k,
    m[1] * k, m[4] * k, m[7] * k,
    m[2] * k, m[5] * k, m[8] * k,
  ])
}
