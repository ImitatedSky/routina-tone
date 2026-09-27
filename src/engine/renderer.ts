import * as twgl from 'twgl.js'
import type { Adjustments } from './adjustments'
import { whiteBalanceMatrix } from './whiteBalance'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders'

export class RendererError extends Error {}

// 把一張照片畫到 canvas 上並套用調整。預覽和匯出各用一個實例。
export class Renderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly program: twgl.ProgramInfo
  private readonly triangle: twgl.BufferInfo
  private texture: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement, options: { preserveDrawingBuffer?: boolean } = {}) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    })
    if (!gl) throw new RendererError('這個瀏覽器不支援 WebGL2，無法調色')
    this.gl = gl
    this.program = twgl.createProgramInfo(gl, [VERTEX_SHADER, FRAGMENT_SHADER])
    // 一個蓋住整個畫面的大三角形，比兩個三角形少一條對角線接縫
    this.triangle = twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 2, data: [-1, -1, 3, -1, -1, 3] },
    })
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number
  }

  setImage(image: ImageBitmap) {
    const { gl } = this
    if (this.texture) gl.deleteTexture(this.texture)
    this.texture = twgl.createTexture(gl, {
      src: image,
      min: gl.LINEAR,
      mag: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      auto: false,
    })
    this.canvas.width = image.width
    this.canvas.height = image.height
    // 瀏覽器可能因為記憶體限制悄悄縮小繪圖緩衝區，這時畫出來的不是原尺寸
    if (gl.drawingBufferWidth !== image.width || gl.drawingBufferHeight !== image.height) {
      throw new RendererError(`圖片太大（${image.width}×${image.height}），瀏覽器無法處理`)
    }
  }

  render(adj: Adjustments) {
    if (!this.texture) return
    const { gl } = this
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.useProgram(this.program.program)
    twgl.setBuffersAndAttributes(gl, this.program, this.triangle)
    twgl.setUniforms(this.program, {
      u_image: this.texture,
      u_whiteBalance: whiteBalanceMatrix(adj.temp, adj.tint),
      u_exposure: adj.exposure,
      u_contrast: adj.contrast / 100,
      u_highlights: adj.highlights / 100,
      u_shadows: adj.shadows / 100,
      u_whites: adj.whites / 100,
      u_blacks: adj.blacks / 100,
      u_vibrance: adj.vibrance / 100,
      u_saturation: adj.saturation / 100,
    })
    twgl.drawBufferInfo(gl, this.triangle)
  }

  dispose() {
    if (this.texture) this.gl.deleteTexture(this.texture)
    this.texture = null
    // 主動釋放 GPU 記憶體，不等 GC（匯出時的全尺寸貼圖很大）
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

export function supportsWebGL2(): boolean {
  return document.createElement('canvas').getContext('webgl2') !== null
}
