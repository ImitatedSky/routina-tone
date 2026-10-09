import { DEFAULT_PIXEL_ART, gridSize, normalizePixelArt } from './pixelArt'

describe('normalizePixelArt', () => {
  it('falls back to defaults for unknown or out-of-range values', () => {
    expect(normalizePixelArt(null)).toEqual(DEFAULT_PIXEL_ART)
    expect(normalizePixelArt({ width: 9999, palette: 'c64', dither: 'ordered', colors: 1.4 })).toEqual({
      ...DEFAULT_PIXEL_ART,
      width: 512,
      dither: 'ordered',
      colors: 2,
    })
  })
})

describe('gridSize', () => {
  it('keeps the photo aspect and never exceeds the source pixels', () => {
    expect(gridSize({ ...DEFAULT_PIXEL_ART, width: 160 }, 4000, 3000)).toEqual({ width: 160, height: 120 })
    expect(gridSize({ ...DEFAULT_PIXEL_ART, width: 512 }, 300, 200)).toEqual({ width: 300, height: 200 })
  })
})
