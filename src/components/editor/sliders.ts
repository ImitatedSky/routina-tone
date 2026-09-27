import type { SliderDef } from './SliderSection'

export const WHITE_BALANCE_SLIDERS: SliderDef[] = [
  { key: 'temp', label: '色溫', track: 'linear-gradient(to right, #3f7fd9, #d9d9d9, #e0b83c)' },
  { key: 'tint', label: '色調', track: 'linear-gradient(to right, #3fae5a, #d9d9d9, #c04fc0)' },
]

export const TONE_SLIDERS: SliderDef[] = [
  { key: 'exposure', label: '曝光' },
  { key: 'contrast', label: '對比' },
  { key: 'highlights', label: '亮部' },
  { key: 'shadows', label: '陰影' },
  { key: 'whites', label: '白色' },
  { key: 'blacks', label: '黑色' },
]

const SATURATION_TRACK = 'linear-gradient(to right, #8a8a8a, #d94f4f, #d9c24f, #4fd96b, #4f9ad9, #b04fd9)'

export const PRESENCE_SLIDERS: SliderDef[] = [
  { key: 'vibrance', label: '自然飽和度', track: SATURATION_TRACK },
  { key: 'saturation', label: '飽和度', track: SATURATION_TRACK },
]

export const PRESENCE_EFFECT_SLIDERS: SliderDef[] = [
  { key: 'texture', label: '紋理' },
  { key: 'clarity', label: '清晰度' },
  { key: 'dehaze', label: '去朦朧' },
]

export const SHARPEN_SLIDERS: SliderDef[] = [
  { key: 'sharpenAmount', label: '總量' },
  { key: 'sharpenRadius', label: '半徑' },
  { key: 'sharpenMasking', label: '遮色片' },
]

export const VIGNETTE_SLIDERS: SliderDef[] = [
  { key: 'vignetteAmount', label: '總量', track: 'linear-gradient(to right, #111, #777, #eee)' },
  { key: 'vignetteMidpoint', label: '中點' },
  { key: 'vignetteFeather', label: '羽化' },
  { key: 'vignetteRoundness', label: '圓度' },
]

export const GRAIN_SLIDERS: SliderDef[] = [
  { key: 'grainAmount', label: '總量' },
  { key: 'grainSize', label: '大小' },
  { key: 'grainRoughness', label: '粗糙度' },
]
