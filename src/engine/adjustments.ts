// 所有調整參數。名稱與數值單位盡量和 Lightroom 一致（曝光是 EV，大部分是 -100..100），
// 方便對照與匯入 .xmp。

export const BANDS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const
export type Band = (typeof BANDS)[number]
type BandName = Capitalize<Band>

export const GRADE_RANGES = ['shadow', 'midtone', 'highlight', 'global'] as const
export type GradeRange = (typeof GRADE_RANGES)[number]
type GradeRangeName = Capitalize<GradeRange>

export type ScalarKey =
  // 基本
  | 'temp'
  | 'tint'
  | 'exposure'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'texture'
  | 'clarity'
  | 'dehaze'
  | 'vibrance'
  | 'saturation'
  // 參數式曲線（Lightroom 的「區域」曲線）
  | 'curveHighlights'
  | 'curveLights'
  | 'curveDarks'
  | 'curveShadows'
  | 'curveShadowSplit'
  | 'curveMidtoneSplit'
  | 'curveHighlightSplit'
  // 混色器（HSL，8 個色帶）
  | `hue${BandName}`
  | `sat${BandName}`
  | `lum${BandName}`
  // 色彩分級
  | `grade${GradeRangeName}${'Hue' | 'Sat' | 'Lum'}`
  | 'gradeBlending'
  | 'gradeBalance'
  // 細節
  | 'sharpenAmount'
  | 'sharpenRadius'
  | 'sharpenMasking'
  // 效果
  | 'vignetteAmount'
  | 'vignetteMidpoint'
  | 'vignetteFeather'
  | 'vignetteRoundness'
  | 'grainAmount'
  | 'grainSize'
  | 'grainRoughness'
  // 幾何：裁切框（在轉正、旋轉後的畫面裡，0..1）、拉直角度、90° 旋轉次數、水平翻轉
  | 'cropX'
  | 'cropY'
  | 'cropW'
  | 'cropH'
  | 'straighten'
  | 'rotation'
  | 'flipH'

/** @deprecated 舊名稱，等同 ScalarKey */
export type AdjustmentKey = ScalarKey

// 點曲線，座標 0..255（和 Lightroom 的 ToneCurvePV2012 一樣）。x 嚴格遞增，至少兩點
export type CurvePoint = [number, number]
export const CURVE_CHANNELS = ['rgb', 'red', 'green', 'blue'] as const
export type CurveChannel = (typeof CURVE_CHANNELS)[number]
export type ToneCurve = Record<CurveChannel, CurvePoint[]>

export type Adjustments = Record<ScalarKey, number> & { curve: ToneCurve }

export interface Range {
  min: number
  max: number
  step: number
}

interface Spec extends Range {
  default: number
}

const PERCENT: Spec = { min: -100, max: 100, step: 1, default: 0 }
const POSITIVE: Spec = { min: 0, max: 100, step: 1, default: 0 }
const HUE: Spec = { min: 0, max: 360, step: 1, default: 0 }

function bandSpecs(prefix: 'hue' | 'sat' | 'lum') {
  return Object.fromEntries(BANDS.map((b) => [prefix + b[0].toUpperCase() + b.slice(1), PERCENT]))
}

function gradeSpecs() {
  const entries: [string, Spec][] = []
  for (const r of GRADE_RANGES) {
    const name = r[0].toUpperCase() + r.slice(1)
    entries.push([`grade${name}Hue`, HUE], [`grade${name}Sat`, POSITIVE], [`grade${name}Lum`, PERCENT])
  }
  return Object.fromEntries(entries)
}

const SPECS = {
  temp: PERCENT,
  tint: PERCENT,
  exposure: { min: -5, max: 5, step: 0.05, default: 0 },
  contrast: PERCENT,
  highlights: PERCENT,
  shadows: PERCENT,
  whites: PERCENT,
  blacks: PERCENT,
  texture: PERCENT,
  clarity: PERCENT,
  dehaze: PERCENT,
  vibrance: PERCENT,
  saturation: PERCENT,

  curveHighlights: PERCENT,
  curveLights: PERCENT,
  curveDarks: PERCENT,
  curveShadows: PERCENT,
  // 三個分界點各自的範圍不重疊，所以永遠保持 shadow < midtone < highlight
  curveShadowSplit: { min: 10, max: 40, step: 1, default: 25 },
  curveMidtoneSplit: { min: 41, max: 59, step: 1, default: 50 },
  curveHighlightSplit: { min: 60, max: 90, step: 1, default: 75 },

  ...bandSpecs('hue'),
  ...bandSpecs('sat'),
  ...bandSpecs('lum'),

  ...gradeSpecs(),
  gradeBlending: { ...POSITIVE, default: 50 },
  gradeBalance: PERCENT,

  sharpenAmount: { min: 0, max: 150, step: 1, default: 0 },
  sharpenRadius: { min: 0.5, max: 3, step: 0.1, default: 1 },
  sharpenMasking: POSITIVE,

  vignetteAmount: PERCENT,
  vignetteMidpoint: { ...POSITIVE, default: 50 },
  vignetteFeather: { ...POSITIVE, default: 50 },
  vignetteRoundness: PERCENT,
  grainAmount: POSITIVE,
  grainSize: { ...POSITIVE, default: 25 },
  grainRoughness: { ...POSITIVE, default: 50 },

  cropX: { min: 0, max: 1, step: 0.0001, default: 0 },
  cropY: { min: 0, max: 1, step: 0.0001, default: 0 },
  cropW: { min: 0.01, max: 1, step: 0.0001, default: 1 },
  cropH: { min: 0.01, max: 1, step: 0.0001, default: 1 },
  straighten: { min: -45, max: 45, step: 0.1, default: 0 },
  // 順時針轉了幾個 90°
  rotation: { min: 0, max: 3, step: 1, default: 0 },
  flipH: { min: 0, max: 1, step: 1, default: 0 },
} as Record<ScalarKey, Spec>

// 幾何設定屬於「這張照片」而不是「風格」，和 Lightroom 一樣不存進預設集，套用預設集時也保留原本的
export const GEOMETRY_KEYS: ScalarKey[] = ['cropX', 'cropY', 'cropW', 'cropH', 'straighten', 'rotation', 'flipH']

export function withoutGeometry(adj: Adjustments): Adjustments {
  const result = { ...adj }
  for (const key of GEOMETRY_KEYS) result[key] = SPECS[key].default
  return result
}

// 套用預設集：風格來自 style，幾何保留 current 的
export function applyStyle(current: Adjustments, style: Adjustments): Adjustments {
  const result = { ...style }
  for (const key of GEOMETRY_KEYS) result[key] = current[key]
  return result
}

export const SCALAR_KEYS = Object.keys(SPECS) as ScalarKey[]
/** @deprecated 舊名稱，等同 SCALAR_KEYS */
export const ADJUSTMENT_KEYS = SCALAR_KEYS

export const ADJUSTMENT_RANGES: Record<ScalarKey, Range> = SPECS

const IDENTITY_CURVE: CurvePoint[] = [
  [0, 0],
  [255, 255],
]

export const DEFAULT_CURVE: ToneCurve = {
  rgb: IDENTITY_CURVE,
  red: IDENTITY_CURVE,
  green: IDENTITY_CURVE,
  blue: IDENTITY_CURVE,
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  ...(Object.fromEntries(SCALAR_KEYS.map((k) => [k, SPECS[k].default])) as Record<ScalarKey, number>),
  curve: DEFAULT_CURVE,
}

export function clampAdjustment(key: ScalarKey, value: number): number {
  const { min, max } = SPECS[key]
  return Math.min(max, Math.max(min, value))
}

export function sameCurvePoints(a: CurvePoint[], b: CurvePoint[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1])
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  return sameCurvePoints(points, IDENTITY_CURVE)
}

export function sameAdjustments(a: Adjustments, b: Adjustments): boolean {
  return (
    SCALAR_KEYS.every((k) => a[k] === b[k]) &&
    CURVE_CHANNELS.every((c) => sameCurvePoints(a.curve[c], b.curve[c]))
  )
}

export function isDefault(adj: Adjustments): boolean {
  return sameAdjustments(adj, DEFAULT_ADJUSTMENTS)
}

// 點曲線：數值夾在 0..255、依 x 排序、x 重複的只留一個，少於兩點就當作沒有曲線
export function normalizeCurvePoints(input: unknown): CurvePoint[] {
  if (!Array.isArray(input)) return IDENTITY_CURVE
  const points: CurvePoint[] = []
  for (const p of input) {
    if (!Array.isArray(p) || p.length < 2) continue
    const [x, y] = p
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue
    points.push([Math.min(255, Math.max(0, x)), Math.min(255, Math.max(0, y))])
  }
  points.sort((a, b) => a[0] - b[0])
  const unique = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0])
  return unique.length >= 2 ? unique : IDENTITY_CURVE
}

// 從不可信的資料（預設集檔、IndexedDB）讀參數：只收認得的欄位、數值夾在範圍內，
// 缺的欄位補預設值。之後新增參數時，舊的資料也能照常讀。
export function normalizeAdjustments(input: unknown): Adjustments {
  const result: Adjustments = { ...DEFAULT_ADJUSTMENTS, curve: { ...DEFAULT_CURVE } }
  if (typeof input !== 'object' || input === null) return result
  const record = input as Record<string, unknown>
  for (const key of SCALAR_KEYS) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = clampAdjustment(key, value)
    }
  }
  const curve = record.curve
  if (typeof curve === 'object' && curve !== null) {
    for (const channel of CURVE_CHANNELS) {
      const points = (curve as Record<string, unknown>)[channel]
      if (points !== undefined) result.curve[channel] = normalizeCurvePoints(points)
    }
  }
  return result
}

export type AdjustmentsPatch = Partial<Record<ScalarKey, number>> & { curve?: Partial<ToneCurve> }

// 只留下和預設值不同的欄位，存檔用
export function diffFromDefaults(adj: Adjustments): AdjustmentsPatch {
  const diff: AdjustmentsPatch = {}
  for (const key of SCALAR_KEYS) {
    if (adj[key] !== DEFAULT_ADJUSTMENTS[key]) diff[key] = adj[key]
  }
  const curve: Partial<ToneCurve> = {}
  for (const channel of CURVE_CHANNELS) {
    if (!isIdentityCurve(adj.curve[channel])) curve[channel] = adj.curve[channel]
  }
  if (Object.keys(curve).length > 0) diff.curve = curve
  return diff
}
