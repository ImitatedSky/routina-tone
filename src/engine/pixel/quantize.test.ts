import { buildPalette, quantizeImage, type DitherMode, type PixelSettings } from './quantize'
import { FIXED_PALETTES, PALETTE_IDS, type Rgb } from './palettes'

function image(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set([...pixel(x, y), 255], (y * w + x) * 4)
  }
  return data
}

// 有漸層、有色相變化，像一張小照片
const photo = (w: number, h: number) =>
  image(w, h, (x, y) => [
    Math.round((x / (w - 1)) * 255),
    Math.round((y / (h - 1)) * 255),
    Math.round(128 + 127 * Math.sin((x + y) / 9)),
  ])

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b

function colorsOf(out: Uint8ClampedArray): Set<number> {
  const set = new Set<number>()
  for (let i = 0; i < out.length; i += 4) set.add(key(out[i], out[i + 1], out[i + 2]))
  return set
}

const DITHERS: DitherMode[] = ['none', 'ordered', 'diffusion']

describe('quantizeImage', () => {
  it('only uses colours from buildPalette, for every palette and dither', () => {
    const data = photo(48, 40)
    for (const palette of PALETTE_IDS) {
      for (const dither of DITHERS) {
        const settings: PixelSettings = { palette, colors: 12, dither }
        const allowed = new Set(buildPalette(data, 48, 40, settings).map(([r, g, b]) => key(r, g, b)))
        const out = quantizeImage(data, 48, 40, settings)
        expect(out).toHaveLength(data.length)
        for (let i = 0; i < out.length; i += 4) {
          expect(allowed.has(key(out[i], out[i + 1], out[i + 2]))).toBe(true)
          expect(out[i + 3]).toBe(255)
        }
      }
    }
  })

  it('auto with 2 colours on a black/white image gives exactly black and white', () => {
    const data = image(20, 10, (x) => (x < 10 ? [0, 0, 0] : [255, 255, 255]))
    const settings: PixelSettings = { palette: 'auto', colors: 2, dither: 'none' }
    expect(buildPalette(data, 20, 10, settings)).toEqual([
      [0, 0, 0],
      [255, 255, 255],
    ])
    expect(quantizeImage(data, 20, 10, settings)).toEqual(data)
  })

  it('auto never returns more colours than the image has', () => {
    const data = image(9, 9, (x) => (x < 3 ? [200, 30, 30] : x < 6 ? [30, 200, 30] : [30, 30, 200]))
    expect(buildPalette(data, 9, 9, { palette: 'auto', colors: 16, dither: 'none' })).toHaveLength(3)
  })

  it('auto builds up to the requested number of colours on a photo', () => {
    const data = photo(64, 64)
    const palette = buildPalette(data, 64, 64, { palette: 'auto', colors: 16, dither: 'none' })
    expect(palette.length).toBeLessThanOrEqual(16)
    expect(palette.length).toBeGreaterThanOrEqual(12)
  })

  it('console16 snaps every colour to 5 bits per channel', () => {
    const data = photo(64, 64)
    const palette = buildPalette(data, 64, 64, { palette: 'console16', colors: 32, dither: 'none' })
    expect(palette.length).toBeGreaterThan(1)
    for (const c of palette) {
      for (const v of c) {
        const level = Math.round((v * 31) / 255)
        expect(v).toBe(Math.round((level * 255) / 31))
      }
    }
    expect(new Set(palette.map(([r, g, b]) => key(r, g, b))).size).toBe(palette.length)
  })

  it('gameboy maps a grey gradient to the 4 shades in order', () => {
    const data = image(256, 4, (x) => [x, x, x])
    const out = quantizeImage(data, 256, 4, { palette: 'gameboy', colors: 4, dither: 'none' })
    const shades = FIXED_PALETTES.gameboy.map(([r, g, b]) => key(r, g, b))
    const row = Array.from({ length: 256 }, (_, x) => shades.indexOf(key(out[x * 4], out[x * 4 + 1], out[x * 4 + 2])))
    expect(row[0]).toBe(0)
    expect(row[255]).toBe(3)
    expect(new Set(row).size).toBe(4)
    for (let x = 1; x < 256; x++) expect(row[x]).toBeGreaterThanOrEqual(row[x - 1])
  })

  it('gameboy stretches a low-contrast photo over all 4 shades', () => {
    const data = image(64, 64, (x) => [100 + x, 110 + x, 90 + x])
    const out = quantizeImage(data, 64, 64, { palette: 'gameboy', colors: 4, dither: 'none' })
    expect(colorsOf(out).size).toBe(4)
  })

  it('ordered and diffusion dither a flat grey into both colours of a 2-colour palette', () => {
    const data = image(32, 32, () => [128, 128, 128])
    const bw: Rgb[] = [
      [0, 0, 0],
      [255, 255, 255],
    ]
    for (const dither of ['ordered', 'diffusion'] as const) {
      const out = quantizeImage(data, 32, 32, { palette: 'auto', colors: 2, dither }, bw)
      let white = 0
      for (let i = 0; i < out.length; i += 4) if (out[i] === 255) white++
      const ratio = white / (32 * 32)
      expect(ratio).toBeGreaterThan(0.1)
      expect(ratio).toBeLessThan(0.9)
      if (dither === 'diffusion') {
        expect(ratio).toBeGreaterThan(0.45)
        expect(ratio).toBeLessThan(0.55)
      }
    }
  })

  it('maps to the nearest fixed colour without dithering', () => {
    const data = image(2, 1, (x) => (x === 0 ? [255, 0, 77] : [0, 0, 0]))
    const out = quantizeImage(data, 2, 1, { palette: 'pico8', colors: 16, dither: 'none' })
    expect(Array.from(out)).toEqual([255, 0, 77, 255, 0, 0, 0, 255])
  })

  it('is deterministic', () => {
    const data = photo(80, 60)
    for (const dither of DITHERS) {
      const settings: PixelSettings = { palette: 'auto', colors: 24, dither }
      expect(buildPalette(data, 80, 60, settings)).toEqual(buildPalette(data, 80, 60, settings))
      expect(quantizeImage(data, 80, 60, settings)).toEqual(quantizeImage(data, 80, 60, settings))
    }
  })

  it('handles 512x512 with 64 colours and diffusion quickly', () => {
    const data = photo(512, 512)
    const settings: PixelSettings = { palette: 'auto', colors: 64, dither: 'diffusion' }
    const t0 = performance.now()
    const palette = buildPalette(data, 512, 512, settings)
    const t1 = performance.now()
    quantizeImage(data, 512, 512, settings, palette)
    const t2 = performance.now()
    quantizeImage(data, 512, 512, { ...settings, dither: 'ordered' }, palette)
    const t3 = performance.now()
    console.log(
      `512x512, ${palette.length} colours: palette ${(t1 - t0).toFixed(1)} ms, ` +
        `diffusion ${(t2 - t1).toFixed(1)} ms, ordered ${(t3 - t2).toFixed(1)} ms`,
    )
    expect(palette.length).toBeGreaterThan(32)
    expect(t2 - t0).toBeLessThan(1000)
  })
})
