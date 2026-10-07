import { FIXED_PALETTES, type PaletteId, type Rgb } from './palettes'
import { SRGB_TO_LINEAR, linearToSrgb, srgbToLinear } from './downscale'

export type DitherMode = 'none' | 'ordered' | 'diffusion'

export interface PixelSettings {
  palette: PaletteId
  colors: number // 2..64，只有 auto / console16 會用到
  dither: DitherMode
}

const MAX_SAMPLES = 20000
const KMEANS_ITERATIONS = 6

// 4x4 Bayer 矩陣，換成 -0.5..0.5 的偏移
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5)

// ---- OKLab ----

function linearToOklab(r: number, g: number, b: number, out: Float64Array, o: number) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

function oklabToRgb(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    Math.round(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    Math.round(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    Math.round(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ]
}

function paletteLabs(palette: Rgb[]): Float64Array {
  const labs = new Float64Array(palette.length * 3)
  palette.forEach(([r, g, b], k) => linearToOklab(SRGB_TO_LINEAR[r], SRGB_TO_LINEAR[g], SRGB_TO_LINEAR[b], labs, k * 3))
  return labs
}

function nearestIndex(labs: Float64Array, count: number, L: number, a: number, b: number): number {
  let best = 0
  let bestDist = Infinity
  for (let k = 0; k < count; k++) {
    const dL = labs[k * 3] - L
    const da = labs[k * 3 + 1] - a
    const db = labs[k * 3 + 2] - b
    const dist = dL * dL + da * da + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = k
    }
  }
  return best
}

// ---- 調色盤 ----

function clampColors(colors: number): number {
  return Math.max(2, Math.min(64, Math.round(colors)))
}

function sortByLightness(colors: Rgb[]): Rgb[] {
  const labs = paletteLabs(colors)
  return colors
    .map((c, k) => ({ c, L: labs[k * 3] }))
    .sort((p, q) => p.L - q.L)
    .map((e) => e.c)
}

// 圖裡的顏色不超過 limit 種就直接回傳，否則回傳 null
function distinctColors(data: Uint8ClampedArray, limit: number): Rgb[] | null {
  const seen = new Set<number>()
  for (let i = 0; i < data.length; i += 4) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    if (seen.size > limit) return null
  }
  return [...seen].map((v) => [v >> 16, (v >> 8) & 255, v & 255])
}

// 用固定間距的格點取樣，避免 Math.random 讓結果每次不同；
// 用二維格點而不是一維跳格，才不會因為跳距剛好整除寬度而只取到幾欄
function sampleLabs(data: Uint8ClampedArray, width: number, height: number): Float64Array {
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / MAX_SAMPLES)))
  const start = step >> 1
  const xs = Math.ceil((width - start) / step)
  const ys = Math.ceil((height - start) / step)
  const labs = new Float64Array(xs * ys * 3)
  let o = 0
  for (let y = start; y < height; y += step) {
    for (let x = start; x < width; x += step) {
      const i = (y * width + x) * 4
      linearToOklab(SRGB_TO_LINEAR[data[i]], SRGB_TO_LINEAR[data[i + 1]], SRGB_TO_LINEAR[data[i + 2]], labs, o)
      o += 3
    }
  }
  return labs
}

interface Box {
  start: number
  end: number
  mean: [number, number, number]
  axis: number
  error: number // 盒內的平方誤差總和，優先切誤差最大的盒子
}

function makeBox(labs: Float64Array, order: Int32Array, start: number, end: number): Box {
  const n = end - start
  const sum = [0, 0, 0]
  const sq = [0, 0, 0]
  for (let k = start; k < end; k++) {
    const o = order[k] * 3
    for (let c = 0; c < 3; c++) {
      const v = labs[o + c]
      sum[c] += v
      sq[c] += v * v
    }
  }
  const mean: [number, number, number] = [sum[0] / n, sum[1] / n, sum[2] / n]
  const variance = mean.map((m, c) => Math.max(0, sq[c] / n - m * m))
  const axis = variance.indexOf(Math.max(...variance))
  return { start, end, mean, axis, error: (variance[0] + variance[1] + variance[2]) * n }
}

function medianCut(labs: Float64Array, count: number, target: number): Float64Array {
  const order = new Int32Array(count)
  for (let k = 0; k < count; k++) order[k] = k
  const boxes = [makeBox(labs, order, 0, count)]
  while (boxes.length < target) {
    let pick = 0
    for (let k = 1; k < boxes.length; k++) if (boxes[k].error > boxes[pick].error) pick = k
    const box = boxes[pick]
    if (box.error <= 1e-12) break
    const axis = box.axis
    order.subarray(box.start, box.end).sort((p, q) => labs[p * 3 + axis] - labs[q * 3 + axis])
    const mid = (box.start + box.end) >> 1
    boxes.splice(pick, 1, makeBox(labs, order, box.start, mid), makeBox(labs, order, mid, box.end))
  }
  const centroids = new Float64Array(boxes.length * 3)
  boxes.forEach((box, k) => centroids.set(box.mean, k * 3))
  return centroids
}

function kMeans(labs: Float64Array, count: number, centroids: Float64Array) {
  const k = centroids.length / 3
  const assigned = new Int32Array(count).fill(-1)
  const sums = new Float64Array(k * 3)
  const sizes = new Int32Array(k)
  for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
    let changed = false
    sums.fill(0)
    sizes.fill(0)
    for (let p = 0; p < count; p++) {
      const o = p * 3
      const c = nearestIndex(centroids, k, labs[o], labs[o + 1], labs[o + 2])
      if (assigned[p] !== c) {
        assigned[p] = c
        changed = true
      }
      sums[c * 3] += labs[o]
      sums[c * 3 + 1] += labs[o + 1]
      sums[c * 3 + 2] += labs[o + 2]
      sizes[c]++
    }
    if (!changed) break
    // 空的群保留原本的中心
    for (let c = 0; c < k; c++) {
      if (sizes[c] === 0) continue
      centroids[c * 3] = sums[c * 3] / sizes[c]
      centroids[c * 3 + 1] = sums[c * 3 + 1] / sizes[c]
      centroids[c * 3 + 2] = sums[c * 3 + 2] / sizes[c]
    }
  }
}

function dedupe(colors: Rgb[]): Rgb[] {
  const seen = new Set<number>()
  return colors.filter(([r, g, b]) => {
    const key = (r << 16) | (g << 8) | b
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function autoPalette(data: Uint8ClampedArray, width: number, height: number, colors: number): Rgb[] {
  const target = clampColors(colors)
  const exact = distinctColors(data, target)
  if (exact) return sortByLightness(exact)

  const labs = sampleLabs(data, width, height)
  const count = labs.length / 3
  const centroids = medianCut(labs, count, target)
  kMeans(labs, count, centroids)
  const result: Rgb[] = []
  for (let k = 0; k < centroids.length; k += 3) {
    result.push(oklabToRgb(centroids[k], centroids[k + 1], centroids[k + 2]))
  }
  return sortByLightness(dedupe(result))
}

// 超任是 15-bit 色（每通道 5 bit），把每個通道對齊到 v*255/31
function snapTo5Bit(v: number): number {
  return Math.round((Math.round((v * 31) / 255) * 255) / 31)
}

export function buildPalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: PixelSettings,
): Rgb[] {
  switch (settings.palette) {
    case 'auto':
      return autoPalette(data, width, height, settings.colors)
    case 'console16': {
      const snapped = autoPalette(data, width, height, settings.colors).map(
        ([r, g, b]): Rgb => [snapTo5Bit(r), snapTo5Bit(g), snapTo5Bit(b)],
      )
      return dedupe(snapped)
    }
    default:
      return FIXED_PALETTES[settings.palette].map(([r, g, b]): Rgb => [r, g, b])
  }
}

// ---- 套用調色盤 ----

// 每個顏色到最近鄰色的平均距離（sRGB 單位），換成每通道的量。
// 抖色偏移跟著調色盤疏密走，2 色和 64 色才都不會太淡或太花
function orderedStrength(palette: Rgb[]): number {
  if (palette.length < 2) return 0
  let total = 0
  for (const p of palette) {
    let best = Infinity
    for (const q of palette) {
      if (p === q) continue
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      if (d < best) best = d
    }
    total += best
  }
  return total / palette.length / Math.sqrt(3)
}

function writeColor(out: Uint8ClampedArray, o: number, c: Rgb) {
  out[o] = c[0]
  out[o + 1] = c[1]
  out[o + 2] = c[2]
  out[o + 3] = 255
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// none / ordered：用 6-bit 的 RGB 快取最近色，相近的顏色只算一次
function mapWithCache(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Rgb[],
  ordered: boolean,
): Uint8ClampedArray {
  const labs = paletteLabs(palette)
  const n = palette.length
  const cache = new Int16Array(1 << 18).fill(-1)
  const lab = new Float64Array(3)
  const strength = ordered ? orderedStrength(palette) : 0
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const offset = ordered ? BAYER4[(y & 3) * 4 + (x & 3)] * strength : 0
      const r = clamp255(data[i] + offset) >> 2
      const g = clamp255(data[i + 1] + offset) >> 2
      const b = clamp255(data[i + 2] + offset) >> 2
      const key = (r << 12) | (g << 6) | b
      let k = cache[key]
      if (k < 0) {
        // 用格子中心代表這一格的顏色
        linearToOklab(srgbToLinear(r * 4 + 1.5), srgbToLinear(g * 4 + 1.5), srgbToLinear(b * 4 + 1.5), lab, 0)
        k = nearestIndex(labs, n, lab[0], lab[1], lab[2])
        cache[key] = k
      }
      writeColor(out, i, palette[k])
    }
  }
  return out
}

// Floyd–Steinberg，蛇行掃描；誤差在 sRGB 浮點空間累積，找最近色用 OKLab
function mapWithDiffusion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Rgb[],
): Uint8ClampedArray {
  const labs = paletteLabs(palette)
  const n = palette.length
  const lab = new Float64Array(3)
  const buf = new Float32Array(width * height * 3)
  for (let p = 0, i = 0; p < buf.length; p += 3, i += 4) {
    buf[p] = data[i]
    buf[p + 1] = data[i + 1]
    buf[p + 2] = data[i + 2]
  }
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const dir = y % 2 === 0 ? 1 : -1
    for (let step = 0; step < width; step++) {
      const x = dir === 1 ? step : width - 1 - step
      const p = (y * width + x) * 3
      const r = clamp255(buf[p])
      const g = clamp255(buf[p + 1])
      const b = clamp255(buf[p + 2])
      linearToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), lab, 0)
      const c = palette[nearestIndex(labs, n, lab[0], lab[1], lab[2])]
      writeColor(out, (y * width + x) * 4, c)
      const er = r - c[0]
      const eg = g - c[1]
      const eb = b - c[2]
      const spread = (dx: number, dy: number, w: number) => {
        const nx = x + dx * dir
        const ny = y + dy
        if (nx < 0 || nx >= width || ny >= height) return
        const q = (ny * width + nx) * 3
        buf[q] += er * w
        buf[q + 1] += eg * w
        buf[q + 2] += eb * w
      }
      spread(1, 0, 7 / 16)
      spread(-1, 1, 3 / 16)
      spread(0, 1, 5 / 16)
      spread(1, 1, 1 / 16)
    }
  }
  return out
}

// Game Boy 模式：只看亮度。用圖本身 2%/98% 的亮度範圍拉滿四階，照片才會用到全部色階
function mapByLuminance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  shades: Rgb[],
  dither: DitherMode,
): Uint8ClampedArray {
  const total = width * height
  const levels = shades.length - 1
  const lum = new Float32Array(total)
  const lab = new Float64Array(3)
  const BINS = 1024
  const hist = new Int32Array(BINS)
  for (let p = 0; p < total; p++) {
    const i = p * 4
    linearToOklab(SRGB_TO_LINEAR[data[i]], SRGB_TO_LINEAR[data[i + 1]], SRGB_TO_LINEAR[data[i + 2]], lab, 0)
    const L = Math.min(1, Math.max(0, lab[0]))
    lum[p] = L
    hist[Math.min(BINS - 1, Math.floor(L * BINS))]++
  }
  const percentile = (fraction: number) => {
    const target = fraction * total
    let seen = 0
    for (let k = 0; k < BINS; k++) {
      seen += hist[k]
      if (seen >= target) return (k + 0.5) / BINS
    }
    return 1
  }
  let lo = percentile(0.02)
  let hi = percentile(0.98)
  // 幾乎單色的圖沒有範圍可拉，改用絕對亮度
  if (hi - lo < 1 / 255) {
    lo = 0
    hi = 1
  }
  for (let p = 0; p < total; p++) lum[p] = Math.min(1, Math.max(0, (lum[p] - lo) / (hi - lo))) * levels

  const out = new Uint8ClampedArray(total * 4)
  if (dither === 'diffusion') {
    for (let y = 0; y < height; y++) {
      const dir = y % 2 === 0 ? 1 : -1
      for (let step = 0; step < width; step++) {
        const x = dir === 1 ? step : width - 1 - step
        const p = y * width + x
        const v = Math.min(levels, Math.max(0, lum[p]))
        const k = Math.round(v)
        writeColor(out, p * 4, shades[k])
        const err = v - k
        const spread = (dx: number, dy: number, w: number) => {
          const nx = x + dx * dir
          const ny = y + dy
          if (nx < 0 || nx >= width || ny >= height) return
          lum[ny * width + nx] += err * w
        }
        spread(1, 0, 7 / 16)
        spread(-1, 1, 3 / 16)
        spread(0, 1, 5 / 16)
        spread(1, 1, 1 / 16)
      }
    }
    return out
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const offset = dither === 'ordered' ? BAYER4[(y & 3) * 4 + (x & 3)] : 0
      const k = Math.min(levels, Math.max(0, Math.round(lum[p] + offset)))
      writeColor(out, p * 4, shades[k])
    }
  }
  return out
}

// 每個像素都換成調色盤裡的某一色（alpha 255）。
// palette 可以傳入已經用 buildPalette 算好的結果，省掉重算（auto 模式要跑 k-means）
export function quantizeImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: PixelSettings,
  palette: Rgb[] = buildPalette(data, width, height, settings),
): Uint8ClampedArray {
  if (settings.palette === 'gameboy') return mapByLuminance(data, width, height, palette, settings.dither)
  if (settings.dither === 'diffusion') return mapWithDiffusion(data, width, height, palette)
  return mapWithCache(data, width, height, palette, settings.dither === 'ordered')
}
