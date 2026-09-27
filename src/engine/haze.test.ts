import { estimateHaze } from './haze'

function image(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y)
      data.set([r, g, b, 255], (y * w + x) * 4)
    }
  }
  return data
}

describe('estimateHaze', () => {
  it('finds a bright, dense haze in a flat hazy image', () => {
    const { dark, atmosphere } = estimateHaze(image(64, 48, () => [200, 205, 210]), 64, 48)
    expect(atmosphere[2]).toBeGreaterThan(0.5)
    expect(dark[64 * 24 + 32]).toBeGreaterThan(0.9)
  })

  it('reports no haze where there are dark pixels', () => {
    // 左半部是飽和的紅，暗通道（最小的通道）是 0；右半部是霧白
    const { dark } = estimateHaze(image(64, 48, (x) => (x < 32 ? [220, 0, 0] : [230, 230, 230])), 64, 48)
    expect(dark[64 * 24 + 5]).toBeLessThan(0.1)
    expect(dark[64 * 24 + 60]).toBeGreaterThan(0.7)
  })

  it('keeps every value within 0..1', () => {
    const { dark } = estimateHaze(image(40, 30, (x, y) => [(x * 7) % 256, (y * 11) % 256, (x * y) % 256]), 40, 30)
    for (const v of dark) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
