import type { Adjustments } from '@/engine/adjustments'
import { outputSize, outputToSource, sourceBounds } from '@/engine/geometry'
import { Renderer, tileMargin } from '@/engine/renderer'
import { t } from '@/i18n/i18n'
import { PREVIEW_MAX_EDGE, decodeImage, resizeImage } from './decode'
import { enlarge, pixelate, type PixelArtSettings } from './pixelArt'

export interface ExportResult {
  blob: Blob
  width: number
  height: number
}

// 輸出每塊的邊長上限。拉直 45° 時一塊輸出要讀的原圖外接框會變成約 1.41 倍，再加上模糊的邊，
// 所以取 GPU 貼圖上限的 60%；手機記憶體也吃得消
const MAX_TILE = 2560

/** 用原圖重新跑一次同樣的調色，輸出 JPEG */
export async function exportImage(
  source: Blob,
  adj: Adjustments,
  quality: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportResult> {
  const output = await renderFull(source, adj, onProgress)
  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error(t().photo.jpegEncodeFailed)
  return { blob, width: output.width, height: output.height }
}

/**
 * 調好色的原尺寸畫面轉成像素畫，輸出 PNG：每一格整數倍、最近鄰放大，
 * PNG 無損，格線不會被壓縮糊掉
 */
export async function exportPixelArt(source: Blob, adj: Adjustments, settings: PixelArtSettings): Promise<ExportResult> {
  const output = await renderFull(source, adj)
  const art = enlarge(pixelate(output, output.width, output.height, settings), settings.scale)
  output.width = 0 // 盡早釋放原尺寸的畫布
  const blob = await new Promise<Blob | null>((resolve) => art.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error(t().photo.pngEncodeFailed)
  return { blob, width: art.width, height: art.height }
}

/**
 * 在「輸出（裁切後）」上分塊：每塊算出它對應到原圖的哪一塊（拉直後是斜的，取外接框），
 * 多讀一圈邊（tileMargin）讓模糊類效果在接縫處和整張一起算時一樣，渲染後拼回一張 2D canvas，
 * 所以不受 GPU 貼圖上限限制。大範圍的分析（清晰度底圖、去霧）用和預覽一樣大小的縮圖，
 * 匯出結果才會和預覽一致。
 */
async function renderFull(
  source: Blob,
  adj: Adjustments,
  onProgress?: (done: number, total: number) => void,
): Promise<HTMLCanvasElement> {
  const glCanvas = document.createElement('canvas')
  const renderer = new Renderer(glCanvas, { preserveDrawingBuffer: true })
  const full = await decodeImage(source)
  try {
    const image = { width: full.width, height: full.height }
    const analysis = await resizeImage(full, PREVIEW_MAX_EDGE)
    renderer.setAnalysis(analysis)
    if (analysis !== full) analysis.close()

    const out = outputSize(adj, image)
    const toSource = outputToSource(adj, image)
    const margin = tileMargin(adj, image)
    const tileSize = Math.min(MAX_TILE, Math.floor(renderer.maxTextureSize * 0.6))
    const columns = Math.ceil(out.width / tileSize)
    const rows = Math.ceil(out.height / tileSize)

    const output = document.createElement('canvas')
    output.width = out.width
    output.height = out.height
    const ctx = output.getContext('2d')
    if (!ctx) throw new Error(t().photo.outputCanvasFailed)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = col * tileSize
        const y = row * tileSize
        const width = Math.min(tileSize, out.width - x)
        const height = Math.min(tileSize, out.height - y)
        const outRegion = { x: x / out.width, y: y / out.height, w: width / out.width, h: height / out.height }

        // 這塊輸出要用到的原圖範圍（像素），加上邊但不超出原圖
        const b = sourceBounds(toSource, outRegion)
        const sx = Math.max(0, Math.floor(b.x * image.width) - margin)
        const sy = Math.max(0, Math.floor(b.y * image.height) - margin)
        const sw = Math.min(image.width, Math.ceil((b.x + b.w) * image.width) + margin) - sx
        const sh = Math.min(image.height, Math.ceil((b.y + b.h) * image.height) + margin) - sy

        const tile = await createImageBitmap(full, sx, sy, Math.max(1, sw), Math.max(1, sh))
        try {
          renderer.setTarget(tile, { x: sx, y: sy, width: Math.max(1, sw), height: Math.max(1, sh) }, image)
          renderer.render(adj, { outRegion })
          ctx.drawImage(glCanvas, 0, 0, glCanvas.width, glCanvas.height, x, y, width, height)
        } finally {
          tile.close()
        }
        onProgress?.(row * columns + col + 1, rows * columns)
      }
    }
    return output
  } finally {
    full.close()
    renderer.dispose()
  }
}
