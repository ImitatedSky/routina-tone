// 所有調整參數。數值單位和 Lightroom 的滑桿一致（曝光是 EV，其他是 -100..100），
// 方便對照與之後匯入 .xmp。
export interface Adjustments {
  temp: number
  tint: number
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  vibrance: number
  saturation: number
}

export type AdjustmentKey = keyof Adjustments

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  temp: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  saturation: 0,
}

export interface Range {
  min: number
  max: number
  step: number
}

const PERCENT: Range = { min: -100, max: 100, step: 1 }

export const ADJUSTMENT_RANGES: Record<AdjustmentKey, Range> = {
  temp: PERCENT,
  tint: PERCENT,
  exposure: { min: -5, max: 5, step: 0.05 },
  contrast: PERCENT,
  highlights: PERCENT,
  shadows: PERCENT,
  whites: PERCENT,
  blacks: PERCENT,
  vibrance: PERCENT,
  saturation: PERCENT,
}

export const ADJUSTMENT_KEYS = Object.keys(DEFAULT_ADJUSTMENTS) as AdjustmentKey[]

export function clampAdjustment(key: AdjustmentKey, value: number): number {
  const { min, max } = ADJUSTMENT_RANGES[key]
  return Math.min(max, Math.max(min, value))
}

export function isDefault(adj: Adjustments): boolean {
  return ADJUSTMENT_KEYS.every((k) => adj[k] === DEFAULT_ADJUSTMENTS[k])
}

export function sameAdjustments(a: Adjustments, b: Adjustments): boolean {
  return ADJUSTMENT_KEYS.every((k) => a[k] === b[k])
}

// 從不可信的資料（預設集檔、IndexedDB）讀參數：只收認得的欄位、數值夾在範圍內，
// 缺的欄位補預設值。之後新增參數時，舊的資料也能照常讀。
export function normalizeAdjustments(input: unknown): Adjustments {
  const result = { ...DEFAULT_ADJUSTMENTS }
  if (typeof input !== 'object' || input === null) return result
  const record = input as Record<string, unknown>
  for (const key of ADJUSTMENT_KEYS) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = clampAdjustment(key, value)
    }
  }
  return result
}

// 只留下和預設值不同的欄位，存檔用
export function diffFromDefaults(adj: Adjustments): Partial<Adjustments> {
  const diff: Partial<Adjustments> = {}
  for (const key of ADJUSTMENT_KEYS) {
    if (adj[key] !== DEFAULT_ADJUSTMENTS[key]) diff[key] = adj[key]
  }
  return diff
}
