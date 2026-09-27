import { useLanguage } from '@/i18n/i18n'
import { saveFile } from './saveFile'

function installBridge(status: 'saved' | 'cancelled' | 'error', message = '') {
  const calls: { base64: string; filename: string; mimeType: string; kind: string }[] = []
  window.RoutinaToneFiles = {
    saveFile(id, base64, filename, mimeType, kind) {
      calls.push({ base64, filename, mimeType, kind })
      setTimeout(() => window.__toneSaveResult?.(id, status, message))
    },
  }
  return calls
}

afterEach(() => {
  delete window.RoutinaToneFiles
})

describe('saveFile through the Android bridge', () => {
  it('sends the file as base64 and resolves with a localized message', async () => {
    const calls = installBridge('saved', 'document')
    const result = await saveFile(new Blob(['hi'], { type: 'text/plain' }), 'a.txt', 'document')
    expect(result).toEqual({ status: 'saved', message: '已儲存' })
    expect(calls).toEqual([{ base64: btoa('hi'), filename: 'a.txt', mimeType: 'text/plain', kind: 'document' }])
  })

  it('describes where a photo was saved', async () => {
    installBridge('saved', 'gallery')
    expect(await saveFile(new Blob(['x']), 'a.jpg', 'image')).toEqual({
      status: 'saved',
      message: '已存到相簿 Pictures/Routina Tone',
    })
  })

  it('resolves as cancelled when the user backs out', async () => {
    installBridge('cancelled')
    expect(await saveFile(new Blob(['x']), 'a.jpg', 'image')).toEqual({ status: 'cancelled' })
  })

  it('rejects with a localized error for the bridge error code', async () => {
    installBridge('error', 'gallery')
    await expect(saveFile(new Blob(['x']), 'a.jpg', 'image')).rejects.toThrow(/^存到相簿失敗$/)
  })

  it('appends the technical detail after the code', async () => {
    installBridge('error', 'write:ENOSPC')
    await expect(saveFile(new Blob(['x']), 'a.txt', 'document')).rejects.toThrow('寫入檔案失敗：ENOSPC')
  })

  it('uses English when the UI is English', async () => {
    useLanguage.getState().setPref('en')
    installBridge('saved', 'gallery')
    expect(await saveFile(new Blob(['x']), 'a.jpg', 'image')).toEqual({
      status: 'saved',
      message: 'Saved to Pictures/Routina Tone',
    })
    installBridge('error', 'dialog:No activity found')
    await expect(saveFile(new Blob(['x']), 'a.txt', 'document')).rejects.toThrow(
      "Couldn't open the save dialog: No activity found",
    )
  })
})
