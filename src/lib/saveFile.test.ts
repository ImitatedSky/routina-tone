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
  it('sends the file as base64 and resolves with the bridge message', async () => {
    const calls = installBridge('saved', '已存到相簿')
    const result = await saveFile(new Blob(['hi'], { type: 'text/plain' }), 'a.txt', 'document')
    expect(result).toEqual({ status: 'saved', message: '已存到相簿' })
    expect(calls).toEqual([{ base64: btoa('hi'), filename: 'a.txt', mimeType: 'text/plain', kind: 'document' }])
  })

  it('resolves as cancelled when the user backs out', async () => {
    installBridge('cancelled')
    expect(await saveFile(new Blob(['x']), 'a.jpg', 'image')).toEqual({ status: 'cancelled' })
  })

  it('rejects with the bridge error message', async () => {
    installBridge('error', '存到相簿失敗')
    await expect(saveFile(new Blob(['x']), 'a.jpg', 'image')).rejects.toThrow('存到相簿失敗')
  })
})
