import type { BrushStroke } from './masks'

// 筆刷遮罩的點陣大小。貼圖是正方形、對應整張原圖的 uv；
// 在原圖像素上畫圓，縮放到正方形後會變成橢圓，所以取樣回原圖時又是圓的
export const BRUSH_SIZE = 1024

export interface ImageSize {
  width: number
  height: number
}

// 把筆畫畫成一張 BRUSH_SIZE² 的灰階（0..255 = 遮罩權重），給 shader 當貼圖用
export function rasterizeStrokes(strokes: BrushStroke[], image: ImageSize): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = BRUSH_SIZE
  canvas.height = BRUSH_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const out = new Uint8Array(BRUSH_SIZE * BRUSH_SIZE)
  if (!ctx) return out

  // 以原圖像素為單位畫
  ctx.scale(BRUSH_SIZE / image.width, BRUSH_SIZE / image.height)
  const longEdge = Math.max(image.width, image.height)

  for (const stroke of strokes) {
    const radius = (stroke.size * longEdge) / 2
    const inner = 1 - stroke.feather / 100
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
    // 沿著路徑每隔一小段蓋一個柔邊圓章
    const spacing = Math.max(1, radius * 0.25)
    const stamp = (x: number, y: number) => {
      const g = ctx.createRadialGradient(x, y, radius * inner * 0.999, x, y, radius)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    const p = stroke.points
    let px = p[0] * image.width
    let py = p[1] * image.height
    stamp(px, py)
    for (let i = 2; i < p.length; i += 2) {
      const x = p[i] * image.width
      const y = p[i + 1] * image.height
      const distance = Math.hypot(x - px, y - py)
      const steps = Math.floor(distance / spacing)
      for (let s = 1; s <= steps; s++) stamp(px + ((x - px) * s) / steps, py + ((y - py) * s) / steps)
      if (steps > 0) {
        px = x
        py = y
      }
    }
  }

  // 只要 alpha：畫的是白色，alpha 就是權重
  const data = ctx.getImageData(0, 0, BRUSH_SIZE, BRUSH_SIZE).data
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3]
  return out
}
