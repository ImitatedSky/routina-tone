import * as twgl from 'twgl.js'
import { t } from '@/i18n/i18n'
import type { Adjustments } from './adjustments'
import { buildCurveLut } from './curves'
import { gradingUniforms, mixerUniforms } from './grading'
import { FULL_CROP, outputSize, outputToSource, toColumnMajor, type CropRect } from './geometry'
import { estimateHaze } from './haze'
import { BRUSH_SIZE, rasterizeStrokes } from './brush'
import { MAX_MASKS, maskUniforms, type BrushStroke, type Mask } from './masks'
import { BLUR_SHADER, DEVELOP_SHADER, LUMA_DOWN_SHADER, VERTEX_SHADER } from './shaders'
import { whiteBalanceMatrix } from './whiteBalance'

export class RendererError extends Error {}

// 模糊半徑都以「照片長邊」的比例定義，預覽和匯出看起來才會一樣
const TEXTURE_SIGMA = 0.0025
// 雜訊是像素等級的，所以降噪的模糊半徑以原圖像素為單位
const NOISE_LUMA_SIGMA = 2
const NOISE_COLOR_SIGMA = 4
const CLARITY_SIGMA = 0.012
// 去霧分析用的縮圖長邊
const HAZE_SIZE = 512
// 模糊前先縮小到 sigma 不超過這個值，大半徑的模糊才不會太慢
const MAX_BLUR_SIGMA = 6
const CURVE_LUT_SIZE = 1024
const HISTOGRAM_WIDTH = 256

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageSize {
  width: number
  height: number
}

export interface Histogram {
  red: Uint32Array
  green: Uint32Array
  blue: Uint32Array
  max: number
}

interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

// 分塊匯出時，每塊要多讀進來的邊（原圖像素），邊緣的模糊才會和整張一起算時一樣
export function tileMargin(adj: Adjustments, image: ImageSize): number {
  const longEdge = Math.max(image.width, image.height)
  return Math.ceil(3 * Math.max(TEXTURE_SIGMA * longEdge, adj.sharpenRadius, NOISE_COLOR_SIGMA)) + 4
}

/**
 * 把照片畫到 canvas 上並套用調整。預覽和匯出各用一個實例。
 *
 * 兩種輸入：
 * - 分析圖（setAnalysis）：整張照片的縮圖，算大範圍的東西——清晰度的模糊底圖、去霧的暗通道。
 *   預覽和匯出都用同樣大小的縮圖，結果才一致。
 * - 目標（setTarget）：真的要畫出來的像素。預覽時是整張縮圖；匯出時是原圖的一塊。
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly develop: twgl.ProgramInfo
  private readonly lumaDown: twgl.ProgramInfo
  private readonly blur: twgl.ProgramInfo
  private readonly triangle: twgl.BufferInfo
  private readonly curves: WebGLTexture

  private clarityBase: Target | null = null
  private haze: WebGLTexture | null = null
  private atmosphere: [number, number, number] = [1, 1, 1]

  private image: WebGLTexture | null = null
  private textureBase: Target | null = null
  // 降噪用：小範圍的模糊亮度、模糊顏色
  private noiseBase: Target | null = null
  private chromaBase: Target | null = null
  private sharpenBase: Target | null = null
  private sharpenRadius = -1
  private region: Region = { x: 0, y: 0, width: 1, height: 1 }
  private imageSize: ImageSize = { width: 1, height: 1 }
  private targetWidth = 1
  private targetHeight = 1

  private histogramTarget: Target | null = null

  // 筆刷遮罩的點陣，每個遮罩一層；記住上次畫的是哪一份筆畫，沒變就不重畫
  private readonly brush: WebGLTexture
  private readonly brushStrokes: (BrushStroke[] | null)[] = Array(MAX_MASKS).fill(null)

  constructor(canvas: HTMLCanvasElement, options: { preserveDrawingBuffer?: boolean } = {}) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    })
    if (!gl) throw new RendererError(t().photo.noWebgl2)
    this.gl = gl
    this.develop = twgl.createProgramInfo(gl, [VERTEX_SHADER, DEVELOP_SHADER])
    this.lumaDown = twgl.createProgramInfo(gl, [VERTEX_SHADER, LUMA_DOWN_SHADER])
    this.blur = twgl.createProgramInfo(gl, [VERTEX_SHADER, BLUR_SHADER])
    // 一個蓋住整個畫面的大三角形
    this.triangle = twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 2, data: [-1, -1, 3, -1, -1, 3] },
    })
    this.brush = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.brush)
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8, BRUSH_SIZE, BRUSH_SIZE, MAX_MASKS)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.curves = twgl.createTexture(gl, {
      width: CURVE_LUT_SIZE,
      height: 4,
      internalFormat: gl.R16F,
      format: gl.RED,
      type: gl.FLOAT,
      src: new Float32Array(CURVE_LUT_SIZE * 4),
      min: gl.LINEAR,
      mag: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      auto: false,
    })
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number
  }

  setAnalysis(analysis: ImageBitmap) {
    const { gl } = this
    const source = this.uploadImage(analysis)
    this.deleteTarget(this.clarityBase)
    this.clarityBase = this.blurLuma(
      source,
      analysis.width,
      analysis.height,
      CLARITY_SIGMA * Math.max(analysis.width, analysis.height),
    )
    gl.deleteTexture(source)

    const estimate = estimateHazeFrom(analysis)
    this.atmosphere = estimate.atmosphere
    if (this.haze) gl.deleteTexture(this.haze)
    const bytes = new Uint8Array(estimate.dark.length)
    estimate.dark.forEach((v, i) => (bytes[i] = Math.round(v * 255)))
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    this.haze = twgl.createTexture(gl, {
      width: estimate.width,
      height: estimate.height,
      internalFormat: gl.R8,
      format: gl.RED,
      type: gl.UNSIGNED_BYTE,
      src: bytes,
      min: gl.LINEAR,
      mag: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      auto: false,
    })
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
  }

  // region 是這塊像素在原圖中的位置（原圖像素），image 是原圖尺寸
  setTarget(bitmap: ImageBitmap, region: Region, image: ImageSize) {
    const { gl } = this
    if (this.image) gl.deleteTexture(this.image)
    this.image = this.uploadImage(bitmap)
    this.region = {
      x: region.x / image.width,
      y: region.y / image.height,
      width: region.width / image.width,
      height: region.height / image.height,
    }
    this.imageSize = image
    this.targetWidth = bitmap.width
    this.targetHeight = bitmap.height

    // 目標像素對原圖像素的比例：預覽是縮圖所以 < 1，匯出是 1
    const scale = bitmap.width / region.width
    this.deleteTarget(this.textureBase)
    this.textureBase = this.blurLuma(
      this.image,
      bitmap.width,
      bitmap.height,
      TEXTURE_SIGMA * Math.max(image.width, image.height) * scale,
    )
    // 預覽是縮圖，原圖幾個像素的雜訊在縮圖上不到一個像素；給個下限，預覽才看得出降噪的效果
    this.deleteTarget(this.noiseBase)
    this.noiseBase = this.blurLuma(this.image, bitmap.width, bitmap.height, Math.max(0.5, NOISE_LUMA_SIGMA * scale))
    this.deleteTarget(this.chromaBase)
    this.chromaBase = this.blurLuma(this.image, bitmap.width, bitmap.height, Math.max(1, NOISE_COLOR_SIGMA * scale), true)
    this.deleteTarget(this.sharpenBase)
    this.sharpenBase = null
    this.sharpenRadius = -1
  }

  /**
   * 畫出輸出（裁切後）的一塊。canvas 會調成這塊的像素大小。
   * - crop：另外指定裁切框（裁切模式時傳整個畫框，讓使用者看到整張轉正後的照片）
   * - outRegion：要畫輸出的哪一塊（0..1）；分塊匯出時才用，預覽是整張
   */
  render(adj: Adjustments, options: { crop?: CropRect; outRegion?: CropRect; showMask?: number } = {}) {
    if (!this.image || !this.textureBase || !this.noiseBase || !this.chromaBase || !this.clarityBase || !this.haze) return
    const { gl } = this
    const crop = options.crop
    const outRegion = options.outRegion ?? FULL_CROP
    const output = outputSize(adj, this.imageSize, crop)
    // 目標像素對原圖像素的比例：預覽是縮圖所以 < 1，匯出是 1
    const renderScale = this.targetWidth / (this.region.width * this.imageSize.width)
    const width = Math.max(1, Math.round(output.width * outRegion.w * renderScale))
    const height = Math.max(1, Math.round(output.height * outRegion.h * renderScale))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      // 瀏覽器可能因為記憶體限制悄悄縮小繪圖緩衝區，這時畫出來的不是原尺寸
      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
        throw new RendererError(t().photo.imageTooLarge(width, height))
      }
    }

    // 銳化半徑是滑桿，變了才重算
    if (!this.sharpenBase || this.sharpenRadius !== adj.sharpenRadius) {
      this.deleteTarget(this.sharpenBase)
      this.sharpenBase = this.blurLuma(this.image, this.targetWidth, this.targetHeight, adj.sharpenRadius * renderScale)
      this.sharpenRadius = adj.sharpenRadius
    }

    const lut = buildCurveLut(adj, CURVE_LUT_SIZE)
    gl.bindTexture(gl.TEXTURE_2D, this.curves)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CURVE_LUT_SIZE, 4, gl.RED, gl.FLOAT, lut)

    this.updateBrushLayers(adj.masks)
    const masks = maskUniforms(adj.masks)
    const grading = gradingUniforms(adj)
    const mixer = mixerUniforms(adj)
    const { region } = this

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    this.draw(this.develop, {
      u_image: this.image,
      u_textureBase: this.textureBase.texture,
      u_noiseBase: this.noiseBase.texture,
      u_chromaBase: this.chromaBase.texture,
      u_noise: [adj.noiseLuminance / 100, adj.noiseLuminanceDetail / 100, adj.noiseColor / 100, adj.noiseColorDetail / 100],
      u_sharpenBase: this.sharpenBase.texture,
      u_clarityBase: this.clarityBase.texture,
      u_haze: this.haze,
      u_curves: this.curves,
      u_region: [region.x, region.y, region.width, region.height],
      u_geometry: toColumnMajor(outputToSource(adj, this.imageSize, crop)),
      u_outRegion: [outRegion.x, outRegion.y, outRegion.w, outRegion.h],
      u_outputSize: [output.width, output.height],
      u_sourceSize: [this.imageSize.width, this.imageSize.height],
      u_maskCount: masks.count,
      u_maskShape: masks.shape,
      u_maskInfo: masks.info,
      u_maskA: masks.a,
      u_maskB: masks.b,
      u_maskWB: masks.whiteBalance,
      u_showMask: options.showMask ?? -1,
      u_brush: this.brush,
      u_atmosphere: this.atmosphere,
      u_whiteBalance: whiteBalanceMatrix(adj.temp, adj.tint),
      u_exposure: adj.exposure,
      u_contrast: adj.contrast / 100,
      u_highlights: adj.highlights / 100,
      u_shadows: adj.shadows / 100,
      u_whites: adj.whites / 100,
      u_blacks: adj.blacks / 100,
      u_texture: adj.texture / 100,
      u_clarity: adj.clarity / 100,
      u_dehaze: adj.dehaze / 100,
      u_vibrance: adj.vibrance / 100,
      u_saturation: adj.saturation / 100,
      u_sharpenAmount: adj.sharpenAmount / 100,
      u_sharpenMasking: adj.sharpenMasking / 100,
      u_sharpenDetail: adj.sharpenDetail / 100,
      u_vignetteHighlights: adj.vignetteHighlights / 100,
      u_hue: mixer.hue,
      u_sat: mixer.sat,
      u_lum: mixer.lum,
      u_gradeShadow: grading.shadow,
      u_gradeMidtone: grading.midtone,
      u_gradeHighlight: grading.highlight,
      u_gradeGlobal: grading.global,
      u_gradePivot: grading.pivot,
      u_gradeBlend: grading.blend,
      u_vignette: [
        adj.vignetteAmount / 100,
        adj.vignetteMidpoint / 100,
        adj.vignetteFeather / 100,
        adj.vignetteRoundness / 100,
      ],
      u_grain: [adj.grainAmount / 100, 1 + (adj.grainSize / 100) * 4, adj.grainRoughness / 100],
    })
  }

  // 必須在 render() 之後、同一個 JS 工作裡呼叫（繪圖緩衝區還沒被瀏覽器清掉）
  readHistogram(): Histogram {
    const { gl } = this
    const width = Math.min(HISTOGRAM_WIDTH, gl.drawingBufferWidth)
    const height = Math.max(1, Math.round((gl.drawingBufferHeight * width) / gl.drawingBufferWidth))
    if (!this.histogramTarget || this.histogramTarget.width !== width || this.histogramTarget.height !== height) {
      this.deleteTarget(this.histogramTarget)
      this.histogramTarget = this.createTarget(width, height)
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.histogramTarget.framebuffer)
    gl.blitFramebuffer(
      0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight,
      0, 0, width, height,
      gl.COLOR_BUFFER_BIT, gl.LINEAR,
    )
    const pixels = new Uint8Array(width * height * 4)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.histogramTarget.framebuffer)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const red = new Uint32Array(256)
    const green = new Uint32Array(256)
    const blue = new Uint32Array(256)
    for (let i = 0; i < pixels.length; i += 4) {
      red[pixels[i]]++
      green[pixels[i + 1]]++
      blue[pixels[i + 2]]++
    }
    // 最高的柱子常常是純黑或純白的一大片，拿它來當刻度會把其他部分壓扁
    let max = 1
    for (let i = 1; i < 255; i++) max = Math.max(max, red[i], green[i], blue[i])
    return { red, green, blue, max }
  }

  dispose() {
    const { gl } = this
    for (const t of [this.image, this.haze, this.curves, this.brush]) if (t) gl.deleteTexture(t)
    for (const t of [this.clarityBase, this.textureBase, this.noiseBase, this.chromaBase, this.sharpenBase, this.histogramTarget]) {
      this.deleteTarget(t)
    }
    this.image = null
    // 主動釋放 GPU 記憶體，不等 GC（匯出時的全尺寸貼圖很大）
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  private updateBrushLayers(masks: Mask[]) {
    const { gl } = this
    masks.slice(0, MAX_MASKS).forEach((mask, layer) => {
      if (mask.type !== 'brush' || this.brushStrokes[layer] === mask.strokes) return
      this.brushStrokes[layer] = mask.strokes
      const pixels = rasterizeStrokes(mask.strokes, this.imageSize)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.brush)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, BRUSH_SIZE, BRUSH_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, pixels)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    })
  }

  private uploadImage(bitmap: ImageBitmap): WebGLTexture {
    const { gl } = this
    return twgl.createTexture(gl, {
      src: bitmap,
      min: gl.LINEAR,
      mag: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      auto: false,
    })
  }

  private createTarget(width: number, height: number): Target {
    const { gl } = this
    const texture = twgl.createTexture(gl, {
      width,
      height,
      min: gl.LINEAR,
      mag: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      auto: false,
    })
    const framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { texture, framebuffer, width, height }
  }

  private deleteTarget(target: Target | null) {
    if (!target) return
    this.gl.deleteTexture(target.texture)
    this.gl.deleteFramebuffer(target.framebuffer)
  }

  private draw(program: twgl.ProgramInfo, uniforms: Record<string, unknown>, target?: Target) {
    const { gl } = this
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.viewport(0, 0, target.width, target.height)
    }
    gl.useProgram(program.program)
    twgl.setBuffersAndAttributes(gl, program, this.triangle)
    twgl.setUniforms(program, { ...uniforms, u_flipY: target ? 0 : 1 })
    twgl.drawBufferInfo(gl, this.triangle)
    if (target) gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // 亮度（keepColor 時是顏色）的高斯模糊。sigma 大時先縮小再模糊（大範圍模糊只剩低頻，縮小不會失真）
  private blurLuma(source: WebGLTexture, width: number, height: number, sigma: number, keepColor = false): Target {
    let factor = 1
    while (sigma / factor > MAX_BLUR_SIGMA && factor < 16) factor *= 2
    const w = Math.max(1, Math.ceil(width / factor))
    const h = Math.max(1, Math.ceil(height / factor))
    const result = this.createTarget(w, h)
    this.draw(this.lumaDown, { u_src: source, u_srcSize: [width, height], u_factor: factor, u_keepColor: keepColor ? 1 : 0 }, result)

    const s = sigma / factor
    if (s >= 0.3) {
      const temp = this.createTarget(w, h)
      this.draw(this.blur, { u_src: result.texture, u_step: [1 / w, 0], u_sigma: s }, temp)
      this.draw(this.blur, { u_src: temp.texture, u_step: [0, 1 / h], u_sigma: s }, result)
      this.deleteTarget(temp)
    }
    return result
  }
}

function estimateHazeFrom(bitmap: ImageBitmap) {
  const scale = Math.min(1, HAZE_SIZE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, width, height)
  return estimateHaze(ctx.getImageData(0, 0, width, height).data, width, height)
}

export function supportsWebGL2(): boolean {
  return document.createElement('canvas').getContext('webgl2') !== null
}
