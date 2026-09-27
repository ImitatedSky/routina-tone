import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { runBatch } from './batch'

const exportJpeg = vi.fn()
const saveFile = vi.fn()

vi.mock('./exportJpeg', () => ({ exportJpeg: (...args: unknown[]) => exportJpeg(...args) }))
vi.mock('@/lib/saveFile', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }))

const files = ['a.jpg', 'b.heic', 'c.png'].map((name) => new File(['x'], name))

beforeEach(() => {
  exportJpeg.mockReset().mockResolvedValue({ blob: new Blob(['jpg']), width: 1, height: 1 })
  saveFile.mockReset().mockResolvedValue({ status: 'saved' })
})

describe('runBatch', () => {
  it('exports every photo with the style but not the crop', async () => {
    const settings = { ...DEFAULT_ADJUSTMENTS, exposure: 1, cropW: 0.5, straighten: 10 }
    const result = await runBatch(files, settings, 0.9)
    expect(result).toEqual({ saved: 3, cancelled: false, failures: [] })
    const used = exportJpeg.mock.calls[0][1]
    expect(used.exposure).toBe(1)
    expect(used.cropW).toBe(1)
    expect(used.straighten).toBe(0)
    expect(saveFile.mock.calls.map((c) => c[1])).toEqual(['a-tone.jpg', 'b-tone.jpg', 'c-tone.jpg'])
  })

  it('keeps going after a failure and reports it', async () => {
    exportJpeg.mockRejectedValueOnce(new Error('bad file'))
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
