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

// 看原圖時拿掉調色與遮罩，裁切與拉直保留，比較的才是同一個畫面
function draw(renderer: Renderer, adjustments: Adjustments, view: DrawView) {
  const adj = view.showOriginal ? { ...applyStyle(adjustments, DEFAULT_ADJUSTMENTS), masks: [] } : adjustments
  // 裁切模式畫整個畫框，裁切框另外疊在上面
  renderer.render(adj, { crop: view.cropMode ? FULL_CROP : undefined, showMask: view.showOriginal ? -1 : view.showMask })
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
  const maskMode = useView((s) => s.maskMode)
  const showMask = useView((s) => s.showMask)
  const selectedMask = useView((s) => s.selectedMask)

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
      draw(renderer, adjustments, currentView(adjustments))
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
        const latest = useEditor.getState().adjustments
        draw(renderer, latest, currentView(latest))
        lastHistogramRef.current = performance.now()
        setHistogram(renderer.readHistogram())
      }, HISTOGRAM_INTERVAL)
    }
  }, [photo, adjustments, showOriginal, showHistogram, cropMode, maskMode, showMask, selectedMask])

  const hideOriginal = () => setShowOriginal(false)
  // 裁切、調遮罩時手指是在拖把手，不是在比較原圖
  const compareHandlers = cropMode || maskMode
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
