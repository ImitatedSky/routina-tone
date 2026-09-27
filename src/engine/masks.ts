import { whiteBalanceMatrix } from './whiteBalance'

// 局部調整（Lightroom 的線性漸層、放射狀漸層）。
//
// 位置存在「原圖 uv」座標上，所以裁切、拉直之後遮罩還是黏在同一塊內容上。
// 每個遮罩有自己的一組局部調整，shader 依遮罩權重把它們加到整體的數值上。

export const MASK_TYPES = ['linear', 'radial'] as const
export type MaskType = (typeof MASK_TYPES)[number]

export const LOCAL_KEYS = [
  'exposure',
  'contrast',
  'highlights',
  'shadows',
  'temp',
  'tint',
  'saturation',
  'clarity',
  'texture',
  'dehaze',
] as const
export type LocalKey = (typeof LOCAL_KEYS)[number]

export interface Mask {
  id: string
  type: MaskType
  // 線性：從 (x0,y0) 完全套用，漸變到 (x1,y1) 完全不套用
  x0: number
  y0: number
  x1: number
  y1: number
  // 放射狀：中心、半徑（rx 是原圖寬的比例、ry 是原圖高的比例）、羽化 0..100、反轉
  cx: number
  cy: number
  rx: number
  ry: number
  feather: number
  invert: boolean
  adjust: Record<LocalKey, number>
}

export const MAX_MASKS = 8

export const LOCAL_RANGES: Record<LocalKey, { min: number; max: number; step: number }> = {
  exposure: { min: -4, max: 4, step: 0.05 },
  contrast: { min: -100, max: 100, step: 1 },
  highlights: { min: -100, max: 100, step: 1 },
  shadows: { min: -100, max: 100, step: 1 },
  temp: { min: -100, max: 100, step: 1 },
  tint: { min: -100, max: 100, step: 1 },
  saturation: { min: -100, max: 100, step: 1 },
  clarity: { min: -100, max: 100, step: 1 },
  texture: { min: -100, max: 100, step: 1 },
  dehaze: { min: -100, max: 100, step: 1 },
}

const ZERO_ADJUST = Object.fromEntries(LOCAL_KEYS.map((k) => [k, 0])) as Record<LocalKey, number>

// 新遮罩的預設位置：線性從上往中間（常用來壓天空），放射狀在中央
export function createMask(type: MaskType, id: string = crypto.randomUUID()): Mask {
  return {
    id,
    type,
    x0: 0.5,
    y0: 0.15,
    x1: 0.5,
    y1: 0.5,
    cx: 0.5,
    cy: 0.5,
    rx: 0.25,
    ry: 0.25,
    feather: 50,
    invert: false,
    adjust: { ...ZERO_ADJUST },
  }
}

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

// 從不可信的資料讀遮罩：不認得的型別丟掉，數值夾在範圍內，最多 MAX_MASKS 個
export function normalizeMasks(input: unknown): Mask[] {
  if (!Array.isArray(input)) return []
  const masks: Mask[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    if (!MASK_TYPES.includes(r.type as MaskType)) continue
    const base = createMask(r.type as MaskType, typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID())
    const adjust = (typeof r.adjust === 'object' && r.adjust !== null ? r.adjust : {}) as Record<string, unknown>
    masks.push({
      ...base,
      x0: num(r.x0, base.x0, -1, 2),
      y0: num(r.y0, base.y0, -1, 2),
      x1: num(r.x1, base.x1, -1, 2),
      y1: num(r.y1, base.y1, -1, 2),
      cx: num(r.cx, base.cx, -1, 2),
      cy: num(r.cy, base.cy, -1, 2),
      rx: num(r.rx, base.rx, 0.005, 2),
      ry: num(r.ry, base.ry, 0.005, 2),
      feather: num(r.feather, base.feather, 0, 100),
      invert: r.invert === true,
      adjust: Object.fromEntries(
        LOCAL_KEYS.map((k) => [k, num(adjust[k], 0, LOCAL_RANGES[k].min, LOCAL_RANGES[k].max)]),
      ) as Record<LocalKey, number>,
    })
    if (masks.length === MAX_MASKS) break
  }
  return masks
}

export function sameMasks(a: Mask[], b: Mask[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}

export interface MaskUniforms {
  count: number
  shape: Float32Array
  info: Float32Array
  a: Float32Array
  b: Float32Array
  whiteBalance: Float32Array
}

// 交給 shader 的陣列。固定 MAX_MASKS 格，沒用到的格子是 0（白平衡是單位矩陣）
export function maskUniforms(masks: Mask[]): MaskUniforms {
  const u: MaskUniforms = {
    count: Math.min(masks.length, MAX_MASKS),
    shape: new Float32Array(MAX_MASKS * 4),
    info: new Float32Array(MAX_MASKS * 4),
    a: new Float32Array(MAX_MASKS * 4),
    b: new Float32Array(MAX_MASKS * 4),
    whiteBalance: new Float32Array(MAX_MASKS * 9),
  }
  for (let i = 0; i < MAX_MASKS; i++) {
    const m = masks[i]
    if (!m) {
      u.whiteBalance.set([1, 0, 0, 0, 1, 0, 0, 0, 1], i * 9)
      continue
    }
    const radial = m.type === 'radial'
    u.shape.set(radial ? [m.cx, m.cy, m.rx, m.ry] : [m.x0, m.y0, m.x1, m.y1], i * 4)
    u.info.set([radial ? 1 : 0, m.feather / 100, m.invert ? 1 : 0, 0], i * 4)
    const k = m.adjust
    u.a.set([k.exposure, k.contrast / 100, k.highlights / 100, k.shadows / 100], i * 4)
    u.b.set([k.saturation / 100, k.clarity / 100, k.texture / 100, k.dehaze / 100], i * 4)
    u.whiteBalance.set(whiteBalanceMatrix(k.temp, k.tint), i * 9)
  }
  return u
}
