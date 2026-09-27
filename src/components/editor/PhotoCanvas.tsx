import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { Renderer, supportsWebGL2 } from '@/engine/renderer'
import { useEditor, useView } from '@/editor/editorStore'

export function PhotoCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [supported] = useState(supportsWebGL2)
  const preview = useEditor((s) => s.photo?.preview)
  const adjustments = useEditor((s) => s.adjustments)
  const showOriginal = useView((s) => s.showOriginal)
  const setShowOriginal = useView((s) => s.setShowOriginal)

  // canvas 每次掛載都重新建立：WebGL context 釋放後同一個 canvas 就不能再用了
  useEffect(() => {
    if (!supported) return
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 m-auto max-h-full max-w-full'
    containerRef.current!.appendChild(canvas)
    rendererRef.current = new Renderer(canvas)
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
      canvas.remove()
    }
  }, [supported])

  useEffect(() => {
    if (!preview) return
    try {
      rendererRef.current?.setImage(preview)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [preview])

  useEffect(() => {
    rendererRef.current?.render(showOriginal ? DEFAULT_ADJUSTMENTS : adjustments)
  }, [preview, adjustments, showOriginal])

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
