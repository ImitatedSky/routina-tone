import { boxDownscale, linearToSrgb } from './downscale'

function image(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set([...pixel(x, y), 255], (y * w + x) * 4)
  }
  return data
}

describe('boxDownscale', () => {
  it('averages a black/white checkerboard in linear light (~188, not 128)', () => {
    const src = image(4, 4, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255]))
    const out = boxDownscale(src, 4, 4, 2, 2)
    for (let i = 0; i < out.length; i += 4) {
      expect(Math.abs(out[i] - 188)).toBeLessThanOrEqual(1)
      expect(out[i + 1]).toBe(out[i])
      expect(out[i + 2]).toBe(out[i])
    }
  })

  it('keeps a flat colour exactly with a non-integer ratio', () => {
    const src = image(5, 5, () => [37, 142, 230])
    const out = boxDownscale(src, 5, 5, 2, 2)
    for (let i = 0; i < out.length; i += 4) {
      expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([37, 142, 230, 255])
    }
  })

  it('weights partially covered source pixels by their coverage', () => {
    // 3 → 2：第 0 格吃到整個白色像素和半個黑色像素，線性光平均是 2/3
    const src = image(3, 1, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]))
    const out = boxDownscale(src, 3, 1, 2, 1)
    expect(out[0]).toBe(Math.round(linearToSrgb(2 / 3)))
    expect(out[4]).toBe(0)
  })

  it('returns dw*dh RGBA pixels with opaque alpha', () => {
    const src = image(17, 9, (x, y) => [x * 10, y * 20, 50])
    src[3] = 0
    const out = boxDownscale(src, 17, 9, 6, 4)
    expect(out).toHaveLength(6 * 4 * 4)
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255)
  })

  it('leaves the image unchanged at the same size', () => {
    const src = image(7, 5, (x, y) => [x * 30, y * 50, (x * y * 7) % 256])
    expect(boxDownscale(src, 7, 5, 7, 5)).toEqual(src)
  })

  it('downscales a large image quickly', () => {
    const src = image(1600, 1200, (x, y) => [x % 256, y % 256, (x + y) % 256])
    const t0 = performance.now()
    const out = boxDownscale(src, 1600, 1200, 512, 384)
    const ms = performance.now() - t0
    console.log(`boxDownscale 1600x1200 -> 512x384: ${ms.toFixed(1)} ms`)
    expect(out).toHaveLength(512 * 384 * 4)
    expect(ms).toBeLessThan(1000)
  })
})
