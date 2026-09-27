import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CropOverlay } from '@/components/crop/CropOverlay'
import { DEFAULT_ADJUSTMENTS, applyStyle, type Adjustments } from '@/engine/adjustments'
import { FULL_CROP } from '@/engine/geometry'
import { Renderer, supportsWebGL2 } from '@/engine/renderer'
import { useEditor, useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { Histogram } from './Histogram'

// 直方圖不必每一格拖曳都更新，太頻繁反而拖慢手機
const HISTOGRAM_INTERVAL = 120

interface Box {
  left: number
  top: number
  width: number
  height: number
}

// 看原圖時只拿掉調色，裁切與拉直保留，比較的才是同一個畫面
function draw(renderer: Renderer, adjustments: Adjustments, showOriginal: boolean, cropMode: boolean) {
  const adj = showOriginal ? applyStyle(adjustments, DEFAULT_ADJUSTMENTS) : adjustments
  // 裁切模式畫整個畫框，裁切框另外疊在上面
  renderer.render(adj, cropMode ? { crop: FULL_CROP } : {})
}

export function PhotoCanvas() {
  const t = useT()
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
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

  // canvas 每次掛載都重新建立：WebGL context 釋放後同一個 canvas 就不能再用了
  useEffect(() => {
    if (!supported) return
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 m-auto max-h-full max-w-full'
    containerRef.current!.appendChild(canvas)
    rendererRef.current = new Renderer(canvas)

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
    try {
      draw(renderer, adjustments, showOriginal, cropMode)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      return
    }
    if (!showHistogram) return

    // 直方圖要在畫完的同一個工作裡讀；太密集時延後到停手後再補一次
    const { setHistogram } = useView.getState()
    const now = performance.now()
    window.clearTimeout(histogramTimerRef.current)
    if (now - lastHistogramRef.current >= HISTOGRAM_INTERVAL) {
      lastHistogramRef.current = now
      setHistogram(renderer.readHistogram())
    } else {
      histogramTimerRef.current = window.setTimeout(() => {
        const view = useView.getState()
        draw(renderer, useEditor.getState().adjustments, view.showOriginal, view.cropMode)
        lastHistogramRef.current = performance.now()
        setHistogram(renderer.readHistogram())
      }, HISTOGRAM_INTERVAL)
    }
  }, [photo, adjustments, showOriginal, showHistogram, cropMode])

  const hideOriginal = () => setShowOriginal(false)
  // 裁切時手指是在拖裁切框，不是在比較原圖
  const compareHandlers = cropMode
    ? {}
    : {
        onPointerDown: () => setShowOriginal(true),
        onPointerUp: hideOriginal,
        onPointerLeave: hideOriginal,
        onPointerCancel: hideOriginal,
      }

  return (
    <div ref={outerRef} className="relative min-h-0 flex-1 bg-canvas">
      <div
        ref={containerRef}
        className="absolute inset-3 select-none"
        style={{ touchAction: 'none' }}
        {...compareHandlers}
        onContextMenu={(e) => e.preventDefault()}
      />
      {cropMode && photo && box && <CropOverlay box={box} />}
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
