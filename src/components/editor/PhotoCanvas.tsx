import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { Renderer, supportsWebGL2 } from '@/engine/renderer'
import { useEditor, useView } from '@/editor/editorStore'
import { Histogram } from './Histogram'

// 直方圖不必每一格拖曳都更新，太頻繁反而拖慢手機
const HISTOGRAM_INTERVAL = 120

export function PhotoCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const lastHistogramRef = useRef(0)
  const histogramTimerRef = useRef<number | undefined>(undefined)
  const [supported] = useState(supportsWebGL2)
  const photo = useEditor((s) => s.photo)
  const adjustments = useEditor((s) => s.adjustments)
  const showOriginal = useView((s) => s.showOriginal)
  const setShowOriginal = useView((s) => s.setShowOriginal)
  const showHistogram = useView((s) => s.showHistogram)

  // canvas 每次掛載都重新建立：WebGL context 釋放後同一個 canvas 就不能再用了
  useEffect(() => {
    if (!supported) return
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 m-auto max-h-full max-w-full'
    containerRef.current!.appendChild(canvas)
    rendererRef.current = new Renderer(canvas)
    return () => {
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
    renderer.render(showOriginal ? DEFAULT_ADJUSTMENTS : adjustments)
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
        renderer.render(useView.getState().showOriginal ? DEFAULT_ADJUSTMENTS : useEditor.getState().adjustments)
        lastHistogramRef.current = performance.now()
        setHistogram(renderer.readHistogram())
      }, HISTOGRAM_INTERVAL)
    }
  }, [photo, adjustments, showOriginal, showHistogram])

  const hideOriginal = () => setShowOriginal(false)

  return (
    <div className="relative min-h-0 flex-1 bg-canvas">
      <div
        ref={containerRef}
        className="absolute inset-3 select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={() => setShowOriginal(true)}
        onPointerUp={hideOriginal}
        onPointerLeave={hideOriginal}
        onPointerCancel={hideOriginal}
        onContextMenu={(e) => e.preventDefault()}
      />
      {showHistogram && <Histogram className="pointer-events-none absolute top-3 right-3" />}
      {showOriginal && (
        <span className="pointer-events-none absolute top-4 left-4 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
          原圖
        </span>
      )}
      {!supported && (
        <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-destructive">
          這個瀏覽器不支援 WebGL2，無法調色
        </p>
      )}
    </div>
  )
}
