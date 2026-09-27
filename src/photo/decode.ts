export class DecodeError extends Error {}

export const PREVIEW_MAX_EDGE = 2048

// 解碼照片並依 EXIF 轉正。有給 maxEdge 時縮到長邊不超過它。
export async function decodeImage(blob: Blob, maxEdge?: number): Promise<ImageBitmap> {
  let full: ImageBitmap
  try {
    full = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    throw new DecodeError('無法讀取這張照片，請使用 JPEG、PNG 或 WebP')
  }
  const longEdge = Math.max(full.width, full.height)
  if (!maxEdge || longEdge <= maxEdge) return full

  const scale = maxEdge / longEdge
  const resized = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * scale),
    resizeHeight: Math.round(full.height * scale),
    resizeQuality: 'high',
  })
  full.close()
  return resized
}
