import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CropOverlay } from '@/components/crop/CropOverlay'
import { MaskOverlay } from '@/components/masks/MaskOverlay'
import { DEFAULT_ADJUSTMENTS, applyStyle, type Adjustments } from '@/engine/adjustments'
import { FULL_CROP } from '@/engine/geometry'
import { Renderer, supportsWebGL2 } from '@/engine/renderer'
import { useEditor, useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { Histogram } from './Histogram'
import { useZoomGestures } from './useZoomGestures'
import { pixelate } from '@/photo/pixelArt'

// 直方圖不必每一格拖曳都更新，太頻繁反而拖慢手機
const HISTOGRAM_INTERVAL = 120

interface Box {
  left: number
  top: number
  width: number
  height: number
}

interface DrawView {
  showOriginal: boolean
  cropMode: boolean
  // 要塗紅顯示範圍的遮罩位置，-1 = 不顯示
  showMask: number
}

// 看原圖時拿掉調色與遮罩，裁切與拉直保留，比較的才是同一個畫面。回傳實際畫的參數
function draw(renderer: Renderer, adjustments: Adjustments, view: DrawView): Adjustments {
  const adj = view.showOriginal ? { ...applyStyle(adjustments, DEFAULT_ADJUSTMENTS), masks: [] } : adjustments
  // 裁切模式畫整個畫框，裁切框另外疊在上面
  renderer.render(adj, { crop: view.cropMode ? FULL_CROP : undefined, showMask: view.showOriginal ? -1 : view.showMask })
  return adj
}

function currentView(adjustments: Adjustments): DrawView {
  const v = useView.getState()
  const index = v.maskMode ? adjustments.masks.findIndex((m) => m.id === v.selectedMask) : -1
  // 畫筆刷時一定要看得到畫到哪裡，所以筆刷遮罩不管開關都顯示紅色範圍（和 Lightroom 一樣）
  const visible = index >= 0 && (v.showMask || adjustments.masks[index].type === 'brush')
  return { showOriginal: v.showOriginal, cropMode: v.cropMode, showMask: visible ? index : -1 }
}

export function PhotoCanvas() {
  const t = useT()
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 畫布放在這一層，縮放平移時只變換這一層；手勢由外面的 containerRef 接
  const zoomRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  // 像素畫模式時，WebGL 畫布藏起來，改顯示這張「一格一像素」的小畫布（CSS 用 pixelated 放大，不內插）
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastHistogramRef = useRef(0)
  const histogramTimerRef = useRef<number | undefined>(undefined)
  const [supported] = useState(supportsWebGL2)
  // 畫布在外框裡的位置，裁切框要疊在同一個位置
  const [box, setBox] = useState<Box | null>(null)
  const photo = useEditor((s) => s.photo)
  const adjustments = useEditor((s) => s.adjustments)
  const showOriginal = useView((s) => s.showOriginal)
  const setShowOriginal = useView((s) => s.setShowOriginal)
  const showHistogram = useView((s) => s.showHistogram)
  const cropMode = useView((s) => s.cropMode)
  const maskMode = useView((s) => s.maskMode)
  const showMask = useView((s) => s.showMask)
  const selectedMask = useView((s) => s.selectedMask)

  // canvas 每次掛載都重新建立：WebGL context 釋放後同一個 canvas 就不能再用了
  useEffect(() => {
    if (!supported) return
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 m-auto max-h-full max-w-full'
    zoomRef.current!.appendChild(canvas)
    rendererRef.current = new Renderer(canvas)
    glCanvasRef.current = canvas
    const pixelCanvas = document.createElement('canvas')
    pixelCanvas.className = 'pointer-events-none absolute inset-0 m-auto hidden'
    pixelCanvas.style.imageRendering = 'pixelated'
    zoomRef.current!.appendChild(pixelCanvas)
    pixelCanvasRef.current = pixelCanvas

    // 畫布大小會隨裁切改變，外框也會隨視窗改變；兩者都要重新對齊裁切框
    const measure = () => {
      const outer = outerRef.current?.getBoundingClientRect()
      const rect = canvas.getBoundingClientRect()
      if (!outer) return
      setBox({ left: rect.left - outer.left, top: rect.top - outer.top, width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    observer.observe(containerRef.current!)

    return () => {
      observer.disconnect()
      window.clearTimeout(histogramTimerRef.current)
      rendererRef.current?.dispose()
      rendererRef.current = null
      canvas.remove()
      pixelCanvas.remove()
    }
  }, [supported])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!photo || !renderer) return
    const { preview } = photo
    try {
      renderer.setAnalysis(preview)
      renderer.setTarget(preview, { x: 0, y: 0, width: photo.width, height: photo.height }, photo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [photo])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    // 直方圖、像素畫都要在畫完的同一個工作裡讀畫布；太密集時延後到停手後再補一次
    const afterDraw = (used: Adjustments) => {
      const view = useView.getState()
      const gl = glCanvasRef.current
      const pixelCanvas = pixelCanvasRef.current
      if (gl && pixelCanvas) {
        // 裁切、遮罩模式要對齊把手，照常顯示 WebGL 畫面
        const showPixels = used.pixelOn === 1 && !view.cropMode && !view.maskMode
        if (showPixels) {
          const art = pixelate(gl, gl.width, gl.height, used)
          pixelCanvas.width = art.width
          pixelCanvas.height = art.height
          pixelCanvas.getContext('2d')!.putImageData(art, 0, 0)
          pixelCanvas.style.width = `${gl.clientWidth}px`
          pixelCanvas.style.height = `${gl.clientHeight}px`
        }
        pixelCanvas.classList.toggle('hidden', !showPixels)
        gl.style.visibility = showPixels ? 'hidden' : ''
      }
      if (view.showHistogram) view.setHistogram(renderer.readHistogram())
    }

    let used: Adjustments
    try {
      used = draw(renderer, adjustments, currentView(adjustments))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      return
    }

    const now = performance.now()
    window.clearTimeout(histogramTimerRef.current)
    if (now - lastHistogramRef.current >= HISTOGRAM_INTERVAL) {
      lastHistogramRef.current = now
      afterDraw(used)
    } else {
      histogramTimerRef.current = window.setTimeout(() => {
        const latest = useEditor.getState().adjustments
        const drawn = draw(renderer, latest, currentView(latest))
        lastHistogramRef.current = performance.now()
        afterDraw(drawn)
      }, HISTOGRAM_INTERVAL)
    }
  }, [photo, adjustments, showOriginal, showHistogram, cropMode, maskMode, showMask, selectedMask])

  // 裁切、調遮罩時手指是在拖把手，不縮放也不比較原圖；換照片或換模式時回到原大小
  const { zoom, handlers } = useZoomGestures(containerRef, {
    enabled: !cropMode && !maskMode,
    // 畫面大小一變，原本的平移量就對不上了，乾脆回到原大小
    resetKey: `${photo?.name ?? ''}|${photo?.width ?? 0}|${cropMode}|${maskMode}|${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
    onPressStart: () => setShowOriginal(true),
    onPressEnd: () => setShowOriginal(false),
  })

  return (
    <div ref={outerRef} className="relative min-h-0 flex-1 overflow-hidden bg-canvas">
      <div
        ref={containerRef}
        className="absolute inset-3 select-none"
        style={{ touchAction: 'none' }}
        {...handlers}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={zoomRef}
          className="absolute inset-0"
          style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`, transformOrigin: '0 0' }}
        />
      </div>
      {cropMode && photo && box && <CropOverlay box={box} />}
      {maskMode && photo && box && <MaskOverlay box={box} />}
      {showHistogram && !cropMode && <Histogram className="pointer-events-none absolute top-3 right-3" />}
      {showOriginal && (
        <span className="pointer-events-none absolute top-4 left-4 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
          {t.editor.canvas.original}
        </span>
      )}
      {!supported && (
        <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-destructive">
          {t.editor.canvas.noWebgl}
        </p>
      )}
    </div>
  )
}
