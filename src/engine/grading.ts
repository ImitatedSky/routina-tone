import { BANDS, GRADE_RANGES, type Adjustments, type GradeRange } from './adjustments'

// 色彩分級與混色器交給 shader 的數值。在 TS 端換算好，shader 只負責套用。

const LUMA = [0.2126, 0.7152, 0.0722]

// 飽和度 100 時，色偏在 sRGB 編碼空間最多推多少
const TINT_STRENGTH = 0.3
// 明度 ±100 時，亮度最多推多少
const LUM_STRENGTH = 0.2

// HSV 色環上的顏色（0=紅、120=綠、240=藍），和色輪元件的慣例一致
export function hueToRgb(hue: number): [number, number, number] {
  const h = (((hue % 360) + 360) % 360) / 60
  const x = 1 - Math.abs((h % 2) - 1)
  if (h < 1) return [1, x, 0]
  if (h < 2) return [x, 1, 0]
  if (h < 3) return [0, 1, x]
  if (h < 4) return [0, x, 1]
  if (h < 5) return [x, 0, 1]
  return [1, 0, x]
}

// 只留色偏、不改亮度：顏色減掉自己的亮度，灰色的部分就是 0
function tintOffset(hue: number, sat: number): [number, number, number] {
  const rgb = hueToRgb(hue)
  const y = rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2]
  const k = (sat / 100) * TINT_STRENGTH
  return [(rgb[0] - y) * k, (rgb[1] - y) * k, (rgb[2] - y) * k]
}

function rangeName(range: GradeRange) {
  return range[0].toUpperCase() + range.slice(1)
}

export interface GradingUniforms {
  // 每一區：rgb = 色偏，a = 亮度偏移
  shadow: Float32Array
  midtone: Float32Array
  highlight: Float32Array
  global: Float32Array
  // 陰影與亮部的分界（感知亮度 0..1），平衡往右 = 亮部範圍變大
  pivot: number
  // 0..1，越大三區重疊越多
  blend: number
}

export function gradingUniforms(adj: Adjustments): GradingUniforms {
  const out = {} as Record<GradeRange, Float32Array>
  for (const range of GRADE_RANGES) {
    const name = rangeName(range)
    const hue = adj[`grade${name}Hue` as keyof Adjustments] as number
    const sat = adj[`grade${name}Sat` as keyof Adjustments] as number
    const lum = adj[`grade${name}Lum` as keyof Adjustments] as number
    out[range] = new Float32Array([...tintOffset(hue, sat), (lum / 100) * LUM_STRENGTH])
  }
  return {
    ...out,
    pivot: 0.5 - (adj.gradeBalance / 100) * 0.3,
    blend: adj.gradeBlending / 100,
  }
}

export interface MixerUniforms {
  hue: Float32Array
  sat: Float32Array
  lum: Float32Array
}

// 8 個色帶依 BANDS 的順序，數值 -1..1
export function mixerUniforms(adj: Adjustments): MixerUniforms {
  const pick = (prefix: 'hue' | 'sat' | 'lum') =>
    new Float32Array(BANDS.map((b) => (adj[`${prefix}${b[0].toUpperCase()}${b.slice(1)}` as keyof Adjustments] as number) / 100))
  return { hue: pick('hue'), sat: pick('sat'), lum: pick('lum') }
}
