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
