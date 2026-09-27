import type { Adjustments } from '@/engine/adjustments'
import { Renderer } from '@/engine/renderer'
import { decodeImage } from './decode'

export interface ExportResult {
  blob: Blob
  width: number
  height: number
}

// 用原圖重新跑一次同樣的調色，輸出 JPEG。
// 超過 GPU 貼圖上限的照片會縮到上限（之後的版本改成分塊渲染保留原尺寸）。
export async function exportJpeg(source: Blob, adj: Adjustments, quality: number): Promise<ExportResult> {
  const canvas = document.createElement('canvas')
  const renderer = new Renderer(canvas, { preserveDrawingBuffer: true })
  let image: ImageBitmap | null = null
  try {
    image = await decodeImage(source, renderer.maxTextureSize)
    renderer.setImage(image)
    renderer.render(adj)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('JPEG 編碼失敗')
    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    image?.close()
    renderer.dispose()
  }
}
