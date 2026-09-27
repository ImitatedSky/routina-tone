import { t } from '@/i18n/i18n'
import { heicToDecodable, isHeic } from './heic'

export class DecodeError extends Error {}

export const PREVIEW_MAX_EDGE = 2048

// 解碼照片並依 EXIF 轉正（原尺寸）。
// 先交給瀏覽器（Safari 能直接解 HEIC）；失敗且真的是 HEIC 才載入 WASM 解碼器轉檔，
// 其他人不必下載那個 2 MB 的解碼器。
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    if (!(await isHeic(blob))) throw new DecodeError(t().photo.unsupportedFormat)
  }
  let converted: Blob
  try {
    converted = await heicToDecodable(blob)
  } catch (error) {
    throw new DecodeError(error instanceof Error ? error.message : t().photo.heicFailed)
  }
  // libheif 已經轉正過，輸出的 JPEG 沒有 EXIF，不會轉兩次
  return createImageBitmap(converted, { imageOrientation: 'from-image' })
}

// 等比縮到長邊不超過 maxEdge；本來就夠小時回傳同一張
export async function resizeImage(image: ImageBitmap, maxEdge: number): Promise<ImageBitmap> {
  const longEdge = Math.max(image.width, image.height)
  if (longEdge <= maxEdge) return image
  const scale = maxEdge / longEdge
  return createImageBitmap(image, {
    resizeWidth: Math.round(image.width * scale),
    resizeHeight: Math.round(image.height * scale),
    resizeQuality: 'high',
  })
}

export interface DecodedPhoto {
  preview: ImageBitmap
  // 原圖（轉正後）的尺寸
  width: number
  height: number
}

// 開照片用：只留預覽縮圖，原圖在匯出時才重新解碼，平常不佔記憶體
export async function decodePreview(blob: Blob): Promise<DecodedPhoto> {
  const full = await decodeImage(blob)
  const { width, height } = full
  const preview = await resizeImage(full, PREVIEW_MAX_EDGE)
  if (preview !== full) full.close()
  return { preview, width, height }
}
