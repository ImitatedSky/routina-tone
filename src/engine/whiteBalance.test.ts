import { whiteBalanceMatrix } from './whiteBalance'

// column-major 的矩陣乘上 (1,1,1)，看灰色會變成什麼顏色
function grayAfter(temp: number, tint: number) {
  const m = whiteBalanceMatrix(temp, tint)
  return {
    r: m[0] + m[3] + m[6],
    g: m[1] + m[4] + m[7],
    b: m[2] + m[5] + m[8],
  }
}

describe('whiteBalanceMatrix', () => {
  it('is the identity when both sliders are zero', () => {
    const m = whiteBalanceMatrix(0, 0)
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    m.forEach((v, i) => expect(v).toBeCloseTo(identity[i], 4))
  })

  it('makes gray warmer for positive temperature', () => {
    const { r, b } = grayAfter(50, 0)
    expect(r).toBeGreaterThan(b)
  })

  it('makes gray cooler for negative temperature', () => {
    const { r, b } = grayAfter(-50, 0)
    expect(b).toBeGreaterThan(r)
  })

  it('makes gray magenta for positive tint and green for negative tint', () => {
    const magenta = grayAfter(0, 50)
    expect(magenta.g).toBeLessThan(magenta.r)
    expect(magenta.g).toBeLessThan(magenta.b)

    const green = grayAfter(0, -50)
    expect(green.g).toBeGreaterThan(green.r)
    expect(green.g).toBeGreaterThan(green.b)
  })

  it('keeps the luminance of gray', () => {
    for (const [temp, tint] of [[100, 0], [-100, 0], [0, 100], [60, -40]]) {
      const { r, g, b } = grayAfter(temp, tint)
      expect(0.2126729 * r + 0.7151522 * g + 0.072175 * b).toBeCloseTo(1, 5)
    }
  })

  it('stays finite at the slider extremes', () => {
    for (const temp of [-100, 100]) {
      for (const tint of [-100, 100]) {
        whiteBalanceMatrix(temp, tint).forEach((v) => expect(Number.isFinite(v)).toBe(true))
      }
    }
  })
})
