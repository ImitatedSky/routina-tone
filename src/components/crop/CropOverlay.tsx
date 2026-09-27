import { useRef, type PointerEvent } from 'react'
import { limitCrop, orientedSize, type CropRect } from '@/engine/geometry'
import { useEditor, useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Drag {
  pointerId: number
  handle: Handle
  startX: number
  startY: number
  start: CropRect
  last: CropRect
}

const MIN_SIZE = 0.05

// 四個角和四條邊的把手。觸控目標比畫出來的大
const HANDLES: { handle: Handle; className: string }[] = [
  { handle: 'nw', className: '-top-3 -left-3 size-7 cursor-nwse-resize' },
  { handle: 'ne', className: '-top-3 -right-3 size-7 cursor-nesw-resize' },
  { handle: 'sw', className: '-bottom-3 -left-3 size-7 cursor-nesw-resize' },
  { handle: 'se', className: '-bottom-3 -right-3 size-7 cursor-nwse-resize' },
  { handle: 'n', className: '-top-3 left-1/2 h-7 w-10 -translate-x-1/2 cursor-ns-resize' },
  { handle: 's', className: '-bottom-3 left-1/2 h-7 w-10 -translate-x-1/2 cursor-ns-resize' },
  { handle: 'w', className: 'top-1/2 -left-3 h-10 w-7 -translate-y-1/2 cursor-ew-resize' },
  { handle: 'e', className: 'top-1/2 -right-3 h-10 w-7 -translate-y-1/2 cursor-ew-resize' },
]

/**
 * 裁切框。放在畫布正上方、和畫布一樣大（box 是畫布在容器裡的位置，像素）。
 * 裁切模式時畫布畫的是整個畫框，所以裁切框的 0..1 座標直接對應到 box。
 */
export function CropOverlay({ box }: { box: { left: number; top: number; width: number; height: number } }) {
  const t = useT()
  const drag = useRef<Drag | null>(null)
  const photo = useEditor((s) => s.photo)
  // 分開取四個數字：selector 回傳新物件會讓 zustand 以為一直在變
  const x = useEditor((s) => s.adjustments.cropX)
  const y = useEditor((s) => s.adjustments.cropY)
  const w = useEditor((s) => s.adjustments.cropW)
  const h = useEditor((s) => s.adjustments.cropH)
  const crop: CropRect = { x, y, w, h }
  const aspect = useView((s) => s.cropAspect)
  if (!photo) return null
  const image = { width: photo.width, height: photo.height }

  function candidate(d: Drag, dx: number, dy: number): CropRect {
    const s = d.start
    if (d.handle === 'move') return { ...s, x: s.x + dx, y: s.y + dy }
    let left = s.x
    let top = s.y
    let right = s.x + s.w
    let bottom = s.y + s.h
    if (d.handle.includes('w')) left = Math.min(left + dx, right - MIN_SIZE)
    if (d.handle.includes('e')) right = Math.max(right + dx, left + MIN_SIZE)
    if (d.handle.includes('n')) top = Math.min(top + dy, bottom - MIN_SIZE)
    if (d.handle.includes('s')) bottom = Math.max(bottom + dy, top + MIN_SIZE)
    let next = { x: left, y: top, w: right - left, h: bottom - top }

    if (aspect !== null) {
      // 鎖定比例：以對角為錨點，依寬度決定高度（0..1 座標要換算畫框的寬高比）
      const o = orientedSize(useEditor.getState().adjustments, image)
      const ratio = (aspect * o.height) / o.width
      const h = next.w / ratio
      next = { ...next, h, y: d.handle.includes('n') ? s.y + s.h - h : s.y }
    }
    return next
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const handle = (e.target as HTMLElement).dataset.handle as Handle | undefined
    if (!handle || e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { pointerId: e.pointerId, handle, startX: e.clientX, startY: e.clientY, start: crop, last: crop }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = (e.clientX - d.startX) / box.width
    const dy = (e.clientY - d.startY) / box.height
    const adj = useEditor.getState().adjustments
    // 碰到照片邊緣就貼著停下
    const next = limitCrop(d.last, candidate(d, dx, dy), adj, image)
    d.last = next
    useEditor.getState().setAdjustments({ cropX: next.x, cropY: next.y, cropW: next.w, cropH: next.h })
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    useEditor.getState().commit()
  }

  // 鎖定比例時只留四個角：拉一條邊會同時改到另一個方向，反而難控制
  const handles = aspect === null ? HANDLES : HANDLES.filter((h) => h.handle.length === 2)

  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        role="group"
        aria-label={t.editor.crop.box}
        data-handle="move"
        className="absolute cursor-move border border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`,
          height: `${crop.h * 100}%`,
        }}
      >
        {/* 三分法格線 */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="border-[0.5px] border-white/30" />
          ))}
        </div>
        {handles.map(({ handle, className }) => (
          <div key={handle} data-handle={handle} className={`absolute flex items-center justify-center ${className}`}>
            <span className="pointer-events-none size-3 rounded-sm border border-black/40 bg-white" />
          </div>
        ))}
      </div>
    </div>
  )
}
