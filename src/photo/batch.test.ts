import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { runBatch } from './batch'

const exportImage = vi.fn()
const saveFile = vi.fn()

vi.mock('./exportImage', () => ({ exportImage: (...args: unknown[]) => exportImage(...args) }))
vi.mock('@/lib/saveFile', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }))

const files = ['a.jpg', 'b.heic', 'c.png'].map((name) => new File(['x'], name))

beforeEach(() => {
  exportImage.mockReset().mockResolvedValue({ blob: new Blob(['jpg']), width: 1, height: 1 })
  saveFile.mockReset().mockResolvedValue({ status: 'saved' })
})

describe('runBatch', () => {
  it('exports every photo with the style but not the crop', async () => {
    const settings = { ...DEFAULT_ADJUSTMENTS, exposure: 1, cropW: 0.5, straighten: 10 }
    const result = await runBatch(files, settings, 0.9)
    expect(result).toEqual({ saved: 3, cancelled: false, failures: [] })
    const used = exportImage.mock.calls[0][1]
    expect(used.exposure).toBe(1)
    expect(used.cropW).toBe(1)
    expect(used.straighten).toBe(0)
    expect(saveFile.mock.calls.map((c) => c[1])).toEqual(['a-tone.jpg', 'b-tone.jpg', 'c-tone.jpg'])
  })

  it('names pixel art exports .png', async () => {
    exportImage.mockResolvedValue({ blob: new Blob(['png'], { type: 'image/png' }), width: 1, height: 1 })
    await runBatch(files.slice(0, 1), { ...DEFAULT_ADJUSTMENTS, pixelOn: 1 }, 0.9)
    expect(saveFile.mock.calls[0][1]).toBe('a-tone.png')
    expect(exportImage.mock.calls[0][1].pixelOn).toBe(1)
  })

  it('keeps going after a failure and reports it', async () => {
    exportImage.mockRejectedValueOnce(new Error('bad file'))
    const result = await runBatch(files, DEFAULT_ADJUSTMENTS, 0.9)
    expect(result.saved).toBe(2)
    expect(result.failures).toEqual([{ name: 'a.jpg', message: 'bad file' }])
  })

  it('stops when cancelled', async () => {
    let calls = 0
    const result = await runBatch(files, DEFAULT_ADJUSTMENTS, 0.9, { isCancelled: () => calls++ >= 1 })
    expect(result.cancelled).toBe(true)
    expect(result.saved).toBe(1)
  })
})
