// sRGB <-> 線性光。縮圖要在線性光下平均，不然黑白交錯會變得太暗（128 而不是 188）

export function srgbToLinear(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// 回傳 0..255 的浮點數，呼叫端自己決定要不要四捨五入
export function linearToSrgb(c: number): number {
  if (c <= 0) return 0
  if (c >= 1) return 255
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
}

export const SRGB_TO_LINEAR = new Float32Array(256)
for (let i = 0; i < 256; i++) SRGB_TO_LINEAR[i] = srgbToLinear(i)

// 一維的覆蓋權重：目的格 d 涵蓋來源 [d*scale, (d+1)*scale)，
// 邊界上的來源像素只算被蓋到的那一部分
interface Weights {
  first: Int32Array // 第一個來源索引
  offset: Int32Array // 在 weights 裡的起點
  count: Int32Array
  weights: Float64Array
}

function boxWeights(srcSize: number, dstSize: number): Weights {
  const scale = srcSize / dstSize
  const first = new Int32Array(dstSize)
  const offset = new Int32Array(dstSize)
  const count = new Int32Array(dstSize)
  const list: number[] = []
  for (let d = 0; d < dstSize; d++) {
    const lo = d * scale
    const hi = d === dstSize - 1 ? srcSize : (d + 1) * scale
    const i0 = Math.floor(lo)
    const i1 = Math.min(srcSize, Math.ceil(hi))
    first[d] = i0
    offset[d] = list.length
    let sum = 0
    for (let i = i0; i < i1; i++) {
      const w = Math.min(i + 1, hi) - Math.max(i, lo)
      list.push(w)
      sum += w
    }
    // 用實際總和正規化，單色圖縮完才會一模一樣
    for (let k = offset[d]; k < list.length; k++) list[k] /= sum
    count[d] = i1 - i0
  }
  return { first, offset, count, weights: Float64Array.from(list) }
}

// 面積加權（box）縮圖，在線性光下平均。可處理非整數倍率。輸出 alpha 一律 255（忽略來源 alpha）。
export function boxDownscale(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const xw = boxWeights(sw, dw)
  const yw = boxWeights(sh, dh)

  // 先水平：每一條來源列縮成 dw 格（線性光）
  const rows = new Float32Array(sh * dw * 3)
  for (let y = 0; y < sh; y++) {
    const srcRow = y * sw * 4
    const dstRow = y * dw * 3
    for (let dx = 0; dx < dw; dx++) {
      let r = 0
      let g = 0
      let b = 0
      const first = xw.first[dx]
      const off = xw.offset[dx]
      const n = xw.count[dx]
      for (let k = 0; k < n; k++) {
        const w = xw.weights[off + k]
        const i = srcRow + (first + k) * 4
        r += w * SRGB_TO_LINEAR[src[i]]
        g += w * SRGB_TO_LINEAR[src[i + 1]]
        b += w * SRGB_TO_LINEAR[src[i + 2]]
      }
      const j = dstRow + dx * 3
      rows[j] = r
      rows[j + 1] = g
      rows[j + 2] = b
    }
  }

  // 再垂直：把覆蓋到的列加權累加
  const out = new Uint8ClampedArray(dw * dh * 4)
  const acc = new Float64Array(dw * 3)
  for (let dy = 0; dy < dh; dy++) {
    acc.fill(0)
    const first = yw.first[dy]
    const off = yw.offset[dy]
    const n = yw.count[dy]
    for (let k = 0; k < n; k++) {
      const w = yw.weights[off + k]
      const row = (first + k) * dw * 3
      for (let j = 0; j < dw * 3; j++) acc[j] += w * rows[row + j]
    }
    const dstRow = dy * dw * 4
    for (let dx = 0; dx < dw; dx++) {
      const o = dstRow + dx * 4
      out[o] = Math.round(linearToSrgb(acc[dx * 3]))
      out[o + 1] = Math.round(linearToSrgb(acc[dx * 3 + 1]))
      out[o + 2] = Math.round(linearToSrgb(acc[dx * 3 + 2]))
      out[o + 3] = 255
    }
  }
  return out
}
