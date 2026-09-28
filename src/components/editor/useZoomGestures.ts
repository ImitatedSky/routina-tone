import { useRef, useState, type PointerEvent, type RefObject, type WheelEvent } from 'react'

export interface Zoom {
  scale: number
  x: number
  y: number
}

const IDENTITY: Zoom = { scale: 1, x: 0, y: 0 }
const MAX_SCALE = 8
const DOUBLE_TAP_SCALE = 2.5
// 手指移動超過這個距離，就不是「按住看原圖」而是在拖曳
const MOVE_THRESHOLD = 8

interface Options {
  // 裁切、遮罩模式時畫布上有把手，不縮放、也不按住看原圖
  enabled: boolean
  // 換照片、換模式、畫面大小改變（收起面板、旋轉手機）時回到原大小。
  // 用 key 而不是 effect 重設，才不會在 effect 裡 setState
  resetKey: string
  // 按住看原圖（只在原大小時；縮放後單指是平移）
  onPressStart: () => void
  onPressEnd: () => void
}

// 限制縮放倍率，並讓放大後的照片一直蓋滿容器，不會被拖出一片空白
function clamp(zoom: Zoom, width: number, height: number): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(1, zoom.scale))
  if (scale === 1) return IDENTITY
  return {
    scale,
    x: Math.min(0, Math.max(width * (1 - scale), zoom.x)),
    y: Math.min(0, Math.max(height * (1 - scale), zoom.y)),
  }
}

/**
 * 照片的縮放手勢：雙指捏合縮放、放大後單指平移、雙擊切換原大小 / 2.5 倍、滑鼠滾輪縮放。
 * 回傳的 zoom 用在內層（畫布那層）的 transform：translate(x, y) scale(scale)，原點在左上。
 */
export function useZoomGestures(ref: RefObject<HTMLElement | null>, options: Options) {
  const [state, setState] = useState<{ key: string; zoom: Zoom }>({ key: options.resetKey, zoom: IDENTITY })
  const zoom = options.enabled && state.key === options.resetKey ? state.zoom : IDENTITY
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; y: number; zoom: Zoom; moved: boolean; pinch?: { distance: number; mid: [number, number] } }>(null)

  function local(e: { clientX: number; clientY: number }): [number, number] {
    const rect = ref.current!.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  function apply(next: Zoom) {
    const rect = ref.current!.getBoundingClientRect()
    setState({ key: options.resetKey, zoom: clamp(next, rect.width, rect.height) })
  }

  // 兩指的距離與中點
  function pinchInfo() {
    const [a, b] = [...pointers.current.values()]
    return { distance: Math.hypot(b.x - a.x, b.y - a.y) || 1, mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] as [number, number] }
  }

  function begin(current: Zoom) {
    const points = [...pointers.current.values()]
    if (points.length >= 2) {
      gesture.current = { x: 0, y: 0, zoom: current, moved: true, pinch: pinchInfo() }
    } else if (points.length === 1) {
      gesture.current = { x: points[0].x, y: points[0].y, zoom: current, moved: false }
    } else {
      gesture.current = null
    }
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!options.enabled) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const [x, y] = local(e)
    pointers.current.set(e.pointerId, { x, y })
    begin(zoom)
    if (pointers.current.size === 1 && zoom.scale === 1) options.onPressStart()
    else options.onPressEnd()
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (!options.enabled || !pointers.current.has(e.pointerId)) return
    const [x, y] = local(e)
    pointers.current.set(e.pointerId, { x, y })
    const g = gesture.current
    if (!g) return
    if (g.pinch && pointers.current.size >= 2) {
      const { distance, mid } = pinchInfo()
      const scale = g.zoom.scale * (distance / g.pinch.distance)
      // 一開始兩指中點底下的那一點，縮放後還在兩指中點底下
      const cx = (g.pinch.mid[0] - g.zoom.x) / g.zoom.scale
      const cy = (g.pinch.mid[1] - g.zoom.y) / g.zoom.scale
      apply({ scale, x: mid[0] - cx * scale, y: mid[1] - cy * scale })
      return
    }
    if (!g.moved && Math.hypot(x - g.x, y - g.y) > MOVE_THRESHOLD) {
      g.moved = true
      options.onPressEnd()
    }
    if (g.moved && g.zoom.scale > 1) apply({ ...g.zoom, x: g.zoom.x + x - g.x, y: g.zoom.y + y - g.y })
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    if (!options.enabled) return
    pointers.current.delete(e.pointerId)
    // 雙指放開一指後，剩下的那指從現在的位置繼續平移，不會跳
    begin(zoom)
    if (pointers.current.size === 0) options.onPressEnd()
  }

  function onDoubleClick(e: { clientX: number; clientY: number }) {
    if (!options.enabled) return
    if (zoom.scale > 1) {
      apply(IDENTITY)
      return
    }
    const [x, y] = local(e)
    apply({ scale: DOUBLE_TAP_SCALE, x: x * (1 - DOUBLE_TAP_SCALE), y: y * (1 - DOUBLE_TAP_SCALE) })
  }

  function onWheel(e: WheelEvent<HTMLElement>) {
    if (!options.enabled) return
    const [x, y] = local(e)
    const scale = zoom.scale * Math.exp(-e.deltaY * 0.002)
    apply({ scale, x: x - ((x - zoom.x) * scale) / zoom.scale, y: y - ((y - zoom.y) * scale) / zoom.scale })
  }

  return {
    zoom,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: (e: PointerEvent<HTMLElement>) => {
        // 滑鼠離開畫面：結束按住看原圖；手指有 capture，不會觸發這裡
        if (e.pointerType === 'mouse') onPointerUp(e)
      },
      onDoubleClick,
      onWheel,
    },
  }
}
