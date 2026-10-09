import { boxDownscale } from '@/engine/pixel/downscale'
import { PALETTE_IDS, type PaletteId } from '@/engine/pixel/palettes'
import { quantizeImage, type DitherMode } from '@/engine/pixel/quantize'

// 像素畫：把調好色的畫面縮到一個小格子（每一格就是一個像素），減成有限的顏色，
// 要放大時只用整數倍、最近鄰（不內插），每一格才會是剛好 N×N 個同色像素、對齊格線。
// 這是「工具」頁的功能，設定和調色參數分開，不進預設集。

export const DITHERS: DitherMode[] = ['none', 'ordered', 'diffusion']

export interface PixelArtSettings {
  // 橫向幾格
  width: number
  palette: PaletteId
  // 色數，只有自動減色、16 位元主機會用到
  colors: number
  dither: DitherMode
  // 匯出時每一格放大成幾 × 幾個像素
  scale: number
}

export type PixelNumberKey = 'width' | 'colors' | 'scale'

export const PIXEL_RANGES: Record<PixelNumberKey, { min: number; max: number; step: number }> = {
  width: { min: 16, max: 512, step: 1 },
  colors: { min: 2, max: 64, step: 1 },
  scale: { min: 1, max: 16, step: 1 },
}

export const DEFAULT_PIXEL_ART: PixelArtSettings = { width: 160, palette: 'auto', colors: 16, dither: 'none', scale: 1 }

// 從 localStorage 這種不可信的來源讀設定：認不得的值用預設
export function normalizePixelArt(input: unknown): PixelArtSettings {
  const result = { ...DEFAULT_PIXEL_ART }
  if (typeof input !== 'object' || input === null) return result
  const record = input as Record<string, unknown>
  for (const key of Object.keys(PIXEL_RANGES) as PixelNumberKey[]) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = clampPixel(key, value)
  }
  if (PALETTE_IDS.includes(record.palette as PaletteId)) result.palette = record.palette as PaletteId
  if (DITHERS.includes(record.dither as DitherMode)) result.dither = record.dither as DitherMode
  return result
}

export function clampPixel(key: PixelNumberKey, value: number): number {
  const { min, max } = PIXEL_RANGES[key]
  return Math.min(max, Math.max(min, Math.round(value)))
}

// 格數：橫向幾格由使用者決定，直向依畫面比例算；不會超過原本的像素數
export function gridSize(settings: PixelArtSettings, width: number, height: number) {
  const w = Math.max(1, Math.min(settings.width, width))
  return { width: w, height: Math.max(1, Math.round((w * height) / width)) }
}

// 先用畫布每次縮一半（剛好 2×2 平均），縮到格子的 4 倍以內再交給精確的 box 平均，
// 大照片才不必整張讀進記憶體
function shrink(source: CanvasImageSource, width: number, height: number, target: { width: number; height: number }) {
  let canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(source, 0, 0)
  while (canvas.width > target.width * 4 && canvas.height > target.height * 4) {
    const next = document.createElement('canvas')
    next.width = Math.ceil(canvas.width / 2)
    next.height = Math.ceil(canvas.height / 2)
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, next.width, next.height)
    canvas.width = 0 // 盡早釋放大畫布
    canvas = next
  }
  return canvas
}

// 回傳格子大小的像素畫（每個像素一格）
export function pixelate(source: CanvasImageSource, width: number, height: number, settings: PixelArtSettings): ImageData {
  const grid = gridSize(settings, width, height)
  const small = shrink(source, width, height, grid)
  const src = small.getContext('2d')!.getImageData(0, 0, small.width, small.height).data
  const scaled = boxDownscale(src, small.width, small.height, grid.width, grid.height)
  const pixels = quantizeImage(scaled, grid.width, grid.height, settings)
  return new ImageData(new Uint8ClampedArray(pixels), grid.width, grid.height)
}

// 整數倍、最近鄰放大成畫布
export function enlarge(art: ImageData, scale: number): HTMLCanvasElement {
  const base = document.createElement('canvas')
  base.width = art.width
  base.height = art.height
  base.getContext('2d')!.putImageData(art, 0, 0)
  if (scale === 1) return base
  const out = document.createElement('canvas')
  out.width = art.width * scale
  out.height = art.height * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(base, 0, 0, out.width, out.height)
  return out
}
