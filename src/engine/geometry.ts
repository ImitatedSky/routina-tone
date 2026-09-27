import type { Adjustments } from './adjustments'

// 裁切、拉直、旋轉、翻轉。
//
// 座標系：
// - 來源：原圖（EXIF 轉正後），uv 0..1
// - 轉向後：先順時針轉 rotation 個 90°、再水平翻轉；尺寸 W'×H'
// - 畫框：和轉向後的圖一樣大的框，照片在框裡繞中心轉 straighten 度（正值 = 順時針）
// - 裁切框：畫框座標裡的矩形（cropX/Y/W/H，0..1），必須整個落在轉過的照片上
// - 輸出：裁切框裡的內容，uv 0..1
//
// 全部是仿射轉換，合成一個 3×3 矩陣交給 shader：輸出 uv → 來源 uv。

export interface Size {
  width: number
  height: number
}

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

type Mat3 = number[] // row-major

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 }

function mul(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c])
    }
  }
  return out
}

function apply(m: Mat3, x: number, y: number): [number, number] {
  return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]]
}

function quarterTurns(adj: Adjustments) {
  return ((Math.round(adj.rotation) % 4) + 4) % 4
}

export function cropOf(adj: Adjustments): CropRect {
  return { x: adj.cropX, y: adj.cropY, w: adj.cropW, h: adj.cropH }
}

// 轉 90° 之後寬高對調
export function orientedSize(adj: Adjustments, image: Size): Size {
  return quarterTurns(adj) % 2 === 1 ? { width: image.height, height: image.width } : image
}

// 輸出（裁切後）的像素尺寸
export function outputSize(adj: Adjustments, image: Size, crop: CropRect = cropOf(adj)): Size {
  const o = orientedSize(adj, image)
  return {
    width: Math.max(1, Math.round(crop.w * o.width)),
    height: Math.max(1, Math.round(crop.h * o.height)),
  }
}

// 輸出 uv → 來源 uv（row-major）。crop 可以另外指定，裁切模式時用整個畫框
export function outputToSource(adj: Adjustments, image: Size, crop: CropRect = cropOf(adj)): Mat3 {
  const { width: W, height: H } = orientedSize(adj, image)
  const theta = (adj.straighten * Math.PI) / 180
  const cos = Math.cos(-theta)
  const sin = Math.sin(-theta)
  const cx = W / 2
  const cy = H / 2

  // 輸出 uv → 畫框像素
  const toFrame: Mat3 = [crop.w * W, 0, crop.x * W, 0, crop.h * H, crop.y * H, 0, 0, 1]
  // 畫框像素 → 轉向後照片的像素：繞中心反向轉 straighten（y 朝下時這個矩陣是順時針）
  const unrotate: Mat3 = [cos, -sin, cx - cos * cx + sin * cy, sin, cos, cy - sin * cx - cos * cy, 0, 0, 1]
  const normalize: Mat3 = [1 / W, 0, 0, 0, 1 / H, 0, 0, 0, 1]
  const unflip: Mat3 = adj.flipH ? [-1, 0, 1, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, 1, 0, 0, 0, 1]
  // 反轉 90°：順時針轉 q 次的逆
  const unturn: Mat3[] = [
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 1, 0, -1, 0, 1, 0, 0, 1],
    [-1, 0, 1, 0, -1, 1, 0, 0, 1],
    [0, -1, 1, 1, 0, 0, 0, 0, 1],
  ]
  return mul(unturn[quarterTurns(adj)], mul(unflip, mul(normalize, mul(unrotate, toFrame))))
}

// GLSL 的 mat3 是 column-major
export function toColumnMajor(m: Mat3): Float32Array {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]])
}

export function mapPoint(m: Mat3, x: number, y: number): [number, number] {
  return apply(m, x, y)
}

// 仿射矩陣（最後一列是 0 0 1）的反矩陣：原圖 uv → 輸出 uv，遮罩把手要畫在畫面上時用
export function invertAffine(m: Mat3): Mat3 {
  const [a, b, c, d, e, f] = m
  const det = a * e - b * d
  return [e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det, 0, 0, 1]
}

// 輸出上一塊矩形（uv）對應到來源的外接矩形（uv），分塊匯出時決定要讀哪一塊原圖
export function sourceBounds(m: Mat3, rect: CropRect): CropRect {
  const corners = [
    apply(m, rect.x, rect.y),
    apply(m, rect.x + rect.w, rect.y),
    apply(m, rect.x, rect.y + rect.h),
    apply(m, rect.x + rect.w, rect.y + rect.h),
  ]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

const EPS = 1e-6

// 裁切框合不合法：整個在畫框裡，而且四個角都落在轉過的照片上
export function isValidCrop(crop: CropRect, adj: Adjustments, image: Size): boolean {
  if (crop.w <= 0 || crop.h <= 0) return false
  if (crop.x < -EPS || crop.y < -EPS || crop.x + crop.w > 1 + EPS || crop.y + crop.h > 1 + EPS) return false
  const m = outputToSource(adj, image, crop)
  return [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].every(([u, v]) => {
    const [sx, sy] = apply(m, u, v)
    return sx > -EPS && sx < 1 + EPS && sy > -EPS && sy < 1 + EPS
  })
}

function lerpCrop(a: CropRect, b: CropRect, t: number): CropRect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t }
}

// 從 from（合法）往 to 移動，走到還合法的最遠處。拖曳裁切框碰到邊時用：會貼著邊停下，不會卡住不動
export function limitCrop(from: CropRect, to: CropRect, adj: Adjustments, image: Size): CropRect {
  if (isValidCrop(to, adj, image)) return to
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (isValidCrop(lerpCrop(from, to, mid), adj, image)) lo = mid
    else hi = mid
  }
  return lerpCrop(from, to, lo)
}

// 以裁切框中心縮小到合法為止（拉直角度變大時用，和 Lightroom 一樣自動縮小裁切框）
export function shrinkToFit(crop: CropRect, adj: Adjustments, image: Size): CropRect {
  if (isValidCrop(crop, adj, image)) return crop
  let cx = crop.x + crop.w / 2
  let cy = crop.y + crop.h / 2
  // 中心本身就不在照片上時，縮再小也沒用，先移回畫框中央
  if (!isValidCrop({ x: cx - 1e-4, y: cy - 1e-4, w: 2e-4, h: 2e-4 }, adj, image)) {
    cx = 0.5
    cy = 0.5
  }
  const scaled = (k: number): CropRect => ({ x: cx - (crop.w * k) / 2, y: cy - (crop.h * k) / 2, w: crop.w * k, h: crop.h * k })
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (isValidCrop(scaled(mid), adj, image)) lo = mid
    else hi = mid
  }
  return scaled(lo)
}

// 置中、指定長寬比（像素的寬 / 高；null = 畫框原本的比例）的最大裁切框
export function largestCrop(aspect: number | null, adj: Adjustments, image: Size): CropRect {
  const o = orientedSize(adj, image)
  const frameAspect = o.width / o.height
  const a = aspect ?? frameAspect
  // 先在畫框裡放進這個比例最大的矩形（normalized）
  const w = a >= frameAspect ? 1 : a / frameAspect
  const h = a >= frameAspect ? frameAspect / a : 1
  return shrinkToFit({ x: (1 - w) / 2, y: (1 - h) / 2, w, h }, adj, image)
}

export { FULL as FULL_CROP }
