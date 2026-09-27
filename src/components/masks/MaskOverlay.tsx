import { useRef, type PointerEvent } from 'react'
import { invertAffine, mapPoint, outputToSource } from '@/engine/geometry'
import type { Mask } from '@/engine/masks'
import { useEditor, useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

type Handle = 'start' | 'end' | 'move' | 'center' | 'rx' | 'ry'

interface Drag {
  pointerId: number
  handle: Handle
  // 按下時指標對應的原圖 uv，與遮罩當時的狀態（移動整個遮罩時用位移算）
  startSrc: [number, number]
  startMask: Mask
}

/**
 * 畫布上的遮罩把手。遮罩存在原圖 uv 上，畫布顯示的是裁切後的輸出，
 * 所以原圖 uv → 輸出 uv 用幾何矩陣的反矩陣，再乘上畫布大小變成畫面座標。
 */
export function MaskOverlay({ box }: { box: Box }) {
  const t = useT()
  const drag = useRef<Drag | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const photo = useEditor((s) => s.photo)
  const adjustments = useEditor((s) => s.adjustments)
  const selectedId = useView((s) => s.selectedMask)
  const selectMask = useView((s) => s.selectMask)
  if (!photo) return null

  const image = { width: photo.width, height: photo.height }
  const toSource = outputToSource(adjustments, image)
  const toOutput = invertAffine(toSource)
  const toScreen = (x: number, y: number): [number, number] => {
    const [u, v] = mapPoint(toOutput, x, y)
    return [u * box.width, v * box.height]
  }
  // 指標位置（畫面）→ 原圖 uv，以整個 svg 為基準
  const toSrc = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect()
    return mapPoint(toSource, (clientX - rect.left) / box.width, (clientY - rect.top) / box.height)
  }

  function onPointerDown(e: PointerEvent<SVGGElement>, mask: Mask, handle: Handle) {
    e.stopPropagation()
    if (e.button !== 0) return
    // 捕捉在 svg 上，手指拖出把手範圍也還收得到移動事件
    svgRef.current?.setPointerCapture?.(e.pointerId)
    selectMask(mask.id)
    drag.current = { pointerId: e.pointerId, handle, startSrc: toSrc(e.clientX, e.clientY), startMask: mask }
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const [x, y] = toSrc(e.clientX, e.clientY)
    const m = d.startMask
    const dx = x - d.startSrc[0]
    const dy = y - d.startSrc[1]
    const update = useEditor.getState().updateMask
    if (d.handle === 'start') update(m.id, { x0: x, y0: y })
    else if (d.handle === 'end') update(m.id, { x1: x, y1: y })
    else if (d.handle === 'move') update(m.id, { x0: m.x0 + dx, y0: m.y0 + dy, x1: m.x1 + dx, y1: m.y1 + dy })
    else if (d.handle === 'center') update(m.id, { cx: m.cx + dx, cy: m.cy + dy })
    // 半徑只看沿著原圖 x／y 軸的距離，照片拉直過也一樣直覺
    else if (d.handle === 'rx') update(m.id, { rx: Math.max(0.01, Math.abs(x - m.cx)) })
    else if (d.handle === 'ry') update(m.id, { ry: Math.max(0.01, Math.abs(y - m.cy)) })
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    useEditor.getState().commit()
  }

  const diagonal = Math.hypot(box.width, box.height)

  function renderLinear(mask: Mask) {
    const a = toScreen(mask.x0, mask.y0)
    const b = toScreen(mask.x1, mask.y1)
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    // 垂直於漸層方向的長線：起點、中間、終點各一條，和 Lightroom 一樣
    const nx = (-(b[1] - a[1]) / len) * diagonal
    const ny = ((b[0] - a[0]) / len) * diagonal
    const line = (p: [number, number], dashed: boolean) => (
      <line
        x1={p[0] - nx}
        y1={p[1] - ny}
        x2={p[0] + nx}
        y2={p[1] + ny}
        stroke="white"
        strokeOpacity={dashed ? 0.6 : 0.9}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '6 5' : undefined}
      />
    )
    return (
      <g key={mask.id}>
        {line(a, false)}
        {line(mid, true)}
        {line(b, false)}
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="white" strokeOpacity={0.5} strokeWidth={1} />
        {handle(mask, 'start', a)}
        {handle(mask, 'end', b)}
        {handle(mask, 'move', mid, true)}
      </g>
    )
  }

  function renderRadial(mask: Mask) {
    const c = toScreen(mask.cx, mask.cy)
    const rxPoint = toScreen(mask.cx + mask.rx, mask.cy)
    const ryPoint = toScreen(mask.cx, mask.cy + mask.ry)
    const rx = Math.hypot(rxPoint[0] - c[0], rxPoint[1] - c[1])
    const ry = Math.hypot(ryPoint[0] - c[0], ryPoint[1] - c[1])
    const angle = (Math.atan2(rxPoint[1] - c[1], rxPoint[0] - c[0]) * 180) / Math.PI
    const inner = 1 - mask.feather / 100
    return (
      <g key={mask.id}>
        <ellipse cx={c[0]} cy={c[1]} rx={rx} ry={ry} transform={`rotate(${angle} ${c[0]} ${c[1]})`} fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={1.5} />
        {inner > 0.02 && inner < 0.98 && (
          <ellipse cx={c[0]} cy={c[1]} rx={rx * inner} ry={ry * inner} transform={`rotate(${angle} ${c[0]} ${c[1]})`} fill="none" stroke="white" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="6 5" />
        )}
        {handle(mask, 'center', c, true)}
        {handle(mask, 'rx', rxPoint)}
        {handle(mask, 'ry', ryPoint)}
      </g>
    )
  }

  // 畫出來的點小，但點擊範圍有 44px，手指才按得到
  function handle(mask: Mask, which: Handle, p: [number, number], filled = false) {
    return (
      <g key={which} data-handle={which} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, mask, which)}>
        <circle cx={p[0]} cy={p[1]} r={22} fill="transparent" />
        <circle cx={p[0]} cy={p[1]} r={filled ? 7 : 6} fill={filled ? 'white' : 'rgb(40 40 40)'} stroke="white" strokeWidth={2} />
      </g>
    )
  }

  // 沒選中的遮罩只畫一個小圖釘，點一下選它
  function renderPin(mask: Mask) {
    const p = mask.type === 'radial' ? toScreen(mask.cx, mask.cy) : toScreen((mask.x0 + mask.x1) / 2, (mask.y0 + mask.y1) / 2)
    return (
      <g key={mask.id} className="cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); selectMask(mask.id) }}>
        <circle cx={p[0]} cy={p[1]} r={20} fill="transparent" />
        <circle cx={p[0]} cy={p[1]} r={6} fill="rgb(40 40 40)" stroke="white" strokeOpacity={0.7} strokeWidth={2} />
      </g>
    )
  }

  const selected = adjustments.masks.find((m) => m.id === selectedId)

  return (
    <svg
      ref={svgRef}
      aria-label={t.masks.overlayLabel}
      className="absolute overflow-hidden"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {adjustments.masks.filter((m) => m.id !== selectedId).map(renderPin)}
      {selected && (selected.type === 'linear' ? renderLinear(selected) : renderRadial(selected))}
    </svg>
  )
}
