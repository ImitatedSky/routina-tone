import type { Messages } from '@/i18n/i18n'
import type { SliderDef } from './SliderSection'

// 各區的滑桿。名稱依語言在畫面上才查（t.editor.adj），這裡只放鍵與軌道顏色
type AdjKey = keyof Messages['editor']['adj']
interface SliderSpec {
  key: AdjKey
  track?: string
}

export const WHITE_BALANCE_SLIDERS: SliderSpec[] = [
  { key: 'temp', track: 'linear-gradient(to right, #3f7fd9, #d9d9d9, #e0b83c)' },
  { key: 'tint', track: 'linear-gradient(to right, #3fae5a, #d9d9d9, #c04fc0)' },
]

export const TONE_SLIDERS: SliderSpec[] = [
  { key: 'exposure' },
  { key: 'contrast' },
  { key: 'highlights' },
  { key: 'shadows' },
  { key: 'whites' },
  { key: 'blacks' },
]

const SATURATION_TRACK = 'linear-gradient(to right, #8a8a8a, #d94f4f, #d9c24f, #4fd96b, #4f9ad9, #b04fd9)'

export const PRESENCE_SLIDERS: SliderSpec[] = [
  { key: 'vibrance', track: SATURATION_TRACK },
  { key: 'saturation', track: SATURATION_TRACK },
]

export const PRESENCE_EFFECT_SLIDERS: SliderSpec[] = [{ key: 'texture' }, { key: 'clarity' }, { key: 'dehaze' }]

export const SHARPEN_SLIDERS: SliderSpec[] = [
  { key: 'sharpenAmount' },
  { key: 'sharpenRadius' },
  { key: 'sharpenDetail' },
  { key: 'sharpenMasking' },
]

export const VIGNETTE_SLIDERS: SliderSpec[] = [
  { key: 'vignetteAmount', track: 'linear-gradient(to right, #111, #777, #eee)' },
  { key: 'vignetteMidpoint' },
  { key: 'vignetteRoundness' },
  { key: 'vignetteFeather' },
  { key: 'vignetteHighlights' },
]

export const GRAIN_SLIDERS: SliderSpec[] = [{ key: 'grainAmount' }, { key: 'grainSize' }, { key: 'grainRoughness' }]

export function withLabels(specs: SliderSpec[], t: Messages): SliderDef[] {
  return specs.map((s) => ({ ...s, label: t.editor.adj[s.key] }))
}
