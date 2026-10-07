import { withoutGeometry, type Adjustments } from '@/engine/adjustments'
import { exportName } from '@/lib/download'
import { saveFile } from '@/lib/saveFile'
import { exportImage } from './exportImage'

export interface BatchProgress {
  done: number
  total: number
  current: string
}

export interface BatchResult {
  saved: number
  cancelled: boolean
  failures: { name: string; message: string }[]
}

/**
 * 把同一組設定套到多張照片，一張一張輸出存檔。
 * 只套用「風格」：裁切、拉直是每張照片自己的，和預設集一樣不跟著套。
 * 一次只處理一張，原圖解碼完就釋放，手機記憶體才撐得住。
 */
export async function runBatch(
  files: File[],
  settings: Adjustments,
  quality: number,
  options: { onProgress?: (p: BatchProgress) => void; isCancelled?: () => boolean } = {},
): Promise<BatchResult> {
  const style = withoutGeometry(settings)
  const result: BatchResult = { saved: 0, cancelled: false, failures: [] }
  for (let i = 0; i < files.length; i++) {
    if (options.isCancelled?.()) {
      result.cancelled = true
      break
    }
    const file = files[i]
    options.onProgress?.({ done: i, total: files.length, current: file.name })
    try {
      const { blob } = await exportImage(file, style, quality)
      const saved = await saveFile(blob, exportName(file.name, blob), 'image')
      if (saved.status === 'saved') result.saved++
    } catch (error) {
      result.failures.push({ name: file.name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  options.onProgress?.({ done: files.length, total: files.length, current: '' })
  return result
}
