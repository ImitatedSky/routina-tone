import type { Adjustments } from '@/engine/adjustments'
import { Renderer, tileMargin } from '@/engine/renderer'
import { t } from '@/i18n/i18n'
import { PREVIEW_MAX_EDGE, decodeImage, resizeImage } from './decode'

export interface ExportResult {
  blob: Blob
  width: number
  height: number
}

// 每塊最大邊長。GPU 貼圖上限常見是 4096–16384，取保守值，手機記憶體也吃得消
const MAX_TILE = 4096

/**
 * 用原圖重新跑一次同樣的調色，輸出 JPEG。
 *
 * 原圖分塊渲染再拼回一張 2D canvas，所以不受 GPU 貼圖上限限制。每塊多讀一圈邊
 * （tileMargin），模糊類的效果在接縫處才會和整張一起算時一樣。
 * 大範圍的分析（清晰度底圖、去霧）用和預覽一樣大小的縮圖，匯出結果才會和預覽一致。
 */
export async function exportJpeg(
  source: Blob,
  adj: Adjustments,
  quality: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportResult> {
  const glCanvas = document.createElement('canvas')
  const renderer = new Renderer(glCanvas, { preserveDrawingBuffer: true })
  const full = await decodeImage(source)
  try {
    const image = { width: full.width, height: full.height }
    const analysis = await resizeImage(full, PREVIEW_MAX_EDGE)
    renderer.setAnalysis(analysis)
    if (analysis !== full) analysis.close()

    const margin = tileMargin(adj, image)
    const tileSize = Math.min(renderer.maxTextureSize, MAX_TILE) - 2 * margin
    const columns = Math.ceil(image.width / tileSize)
    const rows = Math.ceil(image.height / tileSize)

    const output = document.createElement('canvas')
    output.width = image.width
    output.height = image.height
    const ctx = output.getContext('2d')
    if (!ctx) throw new Error(t().photo.outputCanvasFailed)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = col * tileSize
        const y = row * tileSize
        const width = Math.min(tileSize, image.width - x)
        const height = Math.min(tileSize, image.height - y)
        // 加上邊，但不超出照片
        const ox = Math.max(0, x - margin)
        const oy = Math.max(0, y - margin)
        const ow = Math.min(image.width, x + width + margin) - ox
        const oh = Math.min(image.height, y + height + margin) - oy

        const tile = await createImageBitmap(full, ox, oy, ow, oh)
        try {
          renderer.setTarget(tile, { x: ox, y: oy, width: ow, height: oh }, image)
          renderer.render(adj)
          ctx.drawImage(glCanvas, x - ox, y - oy, width, height, x, y, width, height)
        } finally {
          tile.close()
        }
        onProgress?.(row * columns + col + 1, rows * columns)
      }
    }

    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error(t().photo.jpegEncodeFailed)
    return { blob, width: image.width, height: image.height }
  } finally {
    full.close()
    renderer.dispose()
  }
}
