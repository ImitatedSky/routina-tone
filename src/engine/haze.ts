// 去霧的前置分析（He et al. 2009 的暗通道先驗），在 CPU 上對小尺寸縮圖做一次。
//
// 霧氣會讓每個顏色都往大氣光 A 靠，所以「局部最暗的顏色通道」（暗通道）越亮，霧越濃。
// 這裡算出 A 和暗通道，shader 再依滑桿的強度把霧扣掉。
// 暗通道用最小值濾波會在邊緣留下方塊狀的暈，用灰階原圖當導引做 guided filter 修掉。

export interface HazeEstimate {
  // 大氣光，線性 RGB
  atmosphere: [number, number, number]
  // 修飾過的暗通道，0..1，和輸入同尺寸
  dark: Float32Array
  width: number
  height: number
}

const SRGB_TO_LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})

// 可分離的最小值濾波（正方形視窗）
function minFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = Infinity
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.min(m, src[y * w + k])
      tmp[y * w + x] = m
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = Infinity
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.min(m, tmp[k * w + x])
      out[y * w + x] = m
    }
  }
  return out
}

// 可分離的平均濾波，邊緣以實際涵蓋的像素數平均
function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let k = 0; k <= Math.min(w - 1, r); k++) sum += src[y * w + k]
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r)
      const hi = Math.min(w - 1, x + r)
      tmp[y * w + x] = sum / (hi - lo + 1)
      if (x + r + 1 < w) sum += src[y * w + x + r + 1]
      if (x - r >= 0) sum -= src[y * w + x - r]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = 0; k <= Math.min(h - 1, r); k++) sum += tmp[k * w + x]
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r)
      const hi = Math.min(h - 1, y + r)
      out[y * w + x] = sum / (hi - lo + 1)
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x]
      if (y - r >= 0) sum -= tmp[(y - r) * w + x]
    }
  }
  return out
}

// He et al. 2010 的 guided filter：輸出 = a·guide + b，邊緣跟著 guide 走
function guidedFilter(guide: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number) {
  const n = w * h
  const ip = new Float32Array(n)
  const ii = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    ip[i] = guide[i] * p[i]
    ii[i] = guide[i] * guide[i]
  }
  const meanI = boxFilter(guide, w, h, r)
  const meanP = boxFilter(p, w, h, r)
  const meanIp = boxFilter(ip, w, h, r)
  const meanIi = boxFilter(ii, w, h, r)
  const a = new Float32Array(n)
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const variance = meanIi[i] - meanI[i] * meanI[i]
    a[i] = (meanIp[i] - meanI[i] * meanP[i]) / (variance + eps)
    b[i] = meanP[i] - a[i] * meanI[i]
  }
  const meanA = boxFilter(a, w, h, r)
  const meanB = boxFilter(b, w, h, r)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]))
  return out
}

// rgba 是 sRGB 編碼的 8-bit 像素（ImageData.data）
export function estimateHaze(rgba: Uint8ClampedArray, width: number, height: number): HazeEstimate {
  const n = width * height
  const r = new Float32Array(n)
  const g = new Float32Array(n)
  const b = new Float32Array(n)
  const gray = new Float32Array(n)
  const rawDark = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    r[i] = SRGB_TO_LINEAR[rgba[i * 4]]
    g[i] = SRGB_TO_LINEAR[rgba[i * 4 + 1]]
    b[i] = SRGB_TO_LINEAR[rgba[i * 4 + 2]]
    gray[i] = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i]
    rawDark[i] = Math.min(r[i], g[i], b[i])
  }

  // 視窗大小隨圖片縮放，約是長邊的 1.5%
  const patch = Math.max(2, Math.round(Math.max(width, height) * 0.015))
  const dark = minFilter(rawDark, width, height, patch)

  // 大氣光：暗通道最亮的 0.1% 像素的平均顏色
  const count = Math.max(1, Math.round(n * 0.001))
  const brightest = Array.from(dark.keys())
    .sort((i, j) => dark[j] - dark[i])
    .slice(0, count)
  const atmosphere: [number, number, number] = [0, 0, 0]
  for (const i of brightest) {
    atmosphere[0] += r[i] / count
    atmosphere[1] += g[i] / count
    atmosphere[2] += b[i] / count
  }
  // 太暗的大氣光會讓除法爆掉（整張偏暗的照片本來就沒什麼霧）
  for (let c = 0; c < 3; c++) atmosphere[c] = Math.min(1, Math.max(0.3, atmosphere[c]))

  const normalized = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    normalized[i] = Math.min(r[i] / atmosphere[0], g[i] / atmosphere[1], b[i] / atmosphere[2], 1)
  }
  const darkNormalized = minFilter(normalized, width, height, patch)
  const refined = guidedFilter(gray, darkNormalized, width, height, patch * 3, 0.001)
  return { atmosphere, dark: refined, width, height }
}
