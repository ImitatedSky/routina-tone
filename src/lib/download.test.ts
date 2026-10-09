import { exportName } from './download'

describe('exportName', () => {
  it('uses the extension of the exported image type', () => {
    expect(exportName('IMG_0001.HEIC', new Blob([], { type: 'image/jpeg' }))).toBe('IMG_0001-tone.jpg')
    expect(exportName('IMG_0001.HEIC', new Blob([], { type: 'image/png' }))).toBe('IMG_0001-tone.png')
  })
})
