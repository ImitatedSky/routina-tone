// libheif-js 的 HeifDecoder / HeifImage 包裝層沒有型別，這裡只宣告用到的部分
interface HeifImage {
  get_width(): number
  get_height(): number
  is_primary(): boolean
  display(target: ImageData, done: (result: ImageData | null) => void): void
  free(): void
}

interface HeifDecoder {
  decoder: unknown
  decode(buffer: Uint8Array): HeifImage[]
}

interface Libheif {
  HeifDecoder: new () => HeifDecoder
  heif_context_free(context: unknown): void
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

// Android 選檔常給空字串或 application/octet-stream，所以看檔頭的 ftyp brand 判斷
export async function isHeic(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  if (header.length < 12) return false
  const text = String.fromCharCode(...header.subarray(4, 12))
  return text.startsWith('ftyp') && HEIC_BRANDS.includes(text.slice(4))
}

let libheifPromise: Promise<Libheif> | undefined

// 解碼器約 2MB（WASM 內嵌在 JS 裡），只在真的打開 HEIC 時才載入
function loadLibheif(): Promise<Libheif> {
  // @ts-expect-error 套件沒附 .mjs 的型別，回傳值在下面轉成 Libheif
  libheifPromise ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs')
    .then((module) => (module.default as () => Libheif)())
    .catch((error) => {
      libheifPromise = undefined
      throw error
    })
  return libheifPromise
}

// 把 HEIC 轉成 createImageBitmap 讀得了的 JPEG
export async function heicToDecodable(blob: Blob): Promise<Blob> {
  try {
    const libheif = await loadLibheif()
    const decoder = new libheif.HeifDecoder()
    const images = decoder.decode(new Uint8Array(await blob.arrayBuffer()))
    try {
      const image = images.find((item) => item.is_primary()) ?? images[0]
      if (!image) throw new Error('no image in file')
      return await renderToJpeg(image)
    } finally {
      images.forEach((item) => item.free())
      if (decoder.decoder) libheif.heif_context_free(decoder.decoder)
    }
  } catch {
    throw new Error('無法讀取這張 HEIC 照片')
  }
}

async function renderToJpeg(image: HeifImage): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = image.get_width()
  canvas.height = image.get_height()
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  try {
    // libheif 會套用 HEIC 內的旋轉資訊，輸出的 JPEG 不帶 EXIF，不會被轉兩次
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    await new Promise<void>((resolve, reject) => {
      image.display(imageData, (result) => (result ? resolve() : reject(new Error('decode failed'))))
    })
    ctx.putImageData(imageData, 0, 0)

    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    if (!jpeg) throw new Error('encode failed')
    return jpeg
  } finally {
    // 手機上大張 canvas 很吃記憶體，用完馬上釋放
    canvas.width = 0
    canvas.height = 0
  }
}
