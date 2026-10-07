import { FIXED_PALETTES, PALETTE_IDS, type Rgb } from './palettes'

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const key = ([r, g, b]: Rgb) => (r << 16) | (g << 8) | b

describe('palettes', () => {
  it('lists the palette ids in order', () => {
    expect(PALETTE_IDS).toEqual(['auto', 'console16', 'gameboy', 'pico8', 'nes'])
  })

  it('has the four Game Boy greens from dark to light', () => {
    const gb = FIXED_PALETTES.gameboy
    expect(gb).toEqual([
      [0x0f, 0x38, 0x0f],
      [0x30, 0x62, 0x30],
      [0x8b, 0xac, 0x0f],
      [0x9b, 0xbc, 0x0f],
    ])
    for (let k = 1; k < gb.length; k++) expect(luma(gb[k])).toBeGreaterThan(luma(gb[k - 1]))
  })

  it('has the 16 PICO-8 colours', () => {
    expect(FIXED_PALETTES.pico8).toHaveLength(16)
    expect(new Set(FIXED_PALETTES.pico8.map(key)).size).toBe(16)
  })

  it('has no duplicate NES colours', () => {
    const nes = FIXED_PALETTES.nes
    expect(nes.length).toBeGreaterThanOrEqual(50)
    expect(nes.length).toBeLessThanOrEqual(64)
    expect(new Set(nes.map(key)).size).toBe(nes.length)
  })

  it('keeps every channel within 0..255', () => {
    for (const palette of Object.values(FIXED_PALETTES)) {
      for (const c of palette) for (const v of c) expect(v >= 0 && v <= 255 && Number.isInteger(v)).toBe(true)
    }
  })
})
