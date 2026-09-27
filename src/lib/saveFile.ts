import { downloadBlob } from './download'

// Android App 注入的存檔 bridge（android/.../FileSaver.kt）。網頁版沒有它，改用下載。
interface FileBridge {
  saveFile(id: string, base64: string, filename: string, mimeType: string, kind: string): void
}

type BridgeStatus = 'saved' | 'cancelled' | 'error'

declare global {
  interface Window {
    RoutinaToneFiles?: FileBridge
    __toneSaveResult?: (id: string, status: BridgeStatus, message: string) => void
  }
}

export type SaveResult = { status: 'saved'; message?: string } | { status: 'cancelled' }

// image：App 裡存進相簿；document：App 裡跳「另存新檔」
export type SaveKind = 'image' | 'document'

const pending = new Map<string, { resolve: (r: SaveResult) => void; reject: (e: Error) => void }>()

function onBridgeResult(id: string, status: BridgeStatus, message: string) {
  const request = pending.get(id)
  if (!request) return
  pending.delete(id)
  if (status === 'saved') request.resolve({ status: 'saved', message })
  else if (status === 'cancelled') request.resolve({ status: 'cancelled' })
  else request.reject(new Error(message || '儲存失敗'))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // data URL 的格式是 data:<mime>;base64,<內容>
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('讀取檔案失敗'))
    reader.readAsDataURL(blob)
  })
}

export async function saveFile(blob: Blob, filename: string, kind: SaveKind): Promise<SaveResult> {
  const bridge = window.RoutinaToneFiles
  if (!bridge) {
    downloadBlob(blob, filename)
    return { status: 'saved' }
  }
  window.__toneSaveResult ??= onBridgeResult
  const base64 = await toBase64(blob)
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    bridge.saveFile(id, base64, filename, blob.type || 'application/octet-stream', kind)
  })
}
