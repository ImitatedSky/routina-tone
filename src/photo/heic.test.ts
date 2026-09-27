import { heicToDecodable, isHeic } from './heic'

function ftypBlob(brand: string): Blob {
  const bytes = new Uint8Array(32)
  bytes.set([0, 0, 0, 0x18], 0)
  bytes.set(Array.from('ftyp' + brand, (c) => c.charCodeAt(0)), 4)
  return new Blob([bytes])
}

describe('isHeic', () => {
  it('認得 heic brand', async () => {
    expect(await isHeic(ftypBlob('heic'))).toBe(true)
  })

  it('認得 mif1 brand', async () => {
    expect(await isHeic(ftypBlob('mif1'))).toBe(true)
  })

  it('不把 JPEG 當成 HEIC', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])])
    expect(await isHeic(jpeg)).toBe(false)
  })

  it('不把其他 ftyp brand（例如 MP4）當成 HEIC', async () => {
    expect(await isHeic(ftypBlob('isom'))).toBe(false)
  })

  it('太短的檔案回傳 false', async () => {
    expect(await isHeic(new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66])]))).toBe(false)
  })
})

describe('heicToDecodable', () => {
  it('壞掉的檔案丟出中文錯誤', async () => {
    await expect(heicToDecodable(ftypBlob('heic'))).rejects.toThrow('無法讀取這張 HEIC 照片')
  })
})
