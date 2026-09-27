import { useRef, type MouseEvent, type PointerEvent } from 'react'
import type { CurvePoint } from '@/engine/adjustments'

export interface GhostCurve {
  color: string
  curve: (x: number) => number
}

interface Props {
  points: CurvePoint[]
  color: string
  // 要畫出來的曲線（RGB 頻道會是參數式曲線再套點曲線），輸入輸出都是 0..255
  curve: (x: number) => number
  // 其他頻道淡淡地畫在後面
  ghosts: GhostCurve[]
  selected: number | null
  onSelect: (index: number | null) => void
  onChange: (points: CurvePoint[]) => void
  onCommit: () => void
}

const MAX = 255
// 點畫得小，但手指按的範圍要夠大（螢幕 px）
const HIT_RADIUS = 14
// 中間的點拖出框外這麼遠就刪掉，和 Lightroom 一樣
const REMOVE_DISTANCE = 24

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function curvePath(curve: (x: number) => number) {
  const parts: string[] = []
  for (let x = 0; x <= MAX; x += 2) parts.push(`${x},${MAX - curve(x)}`)
  parts.push(`${MAX},${MAX - curve(MAX)}`)
  return 'M' + parts.join('L')
}

interface Drag {
  index: number
  // 拖曳中的點（不含刪除），拖回框內時點會回來
  points: CurvePoint[]
  removed: boolean
}

export function CurveEditor({ points, color, curve, ghosts, selected, onSelect, onChange, onCommit }: Props) {
  const drag = useRef<Drag | null>(null)

  // 螢幕座標轉成曲線座標，pxPerUnit 用來把螢幕距離換算成曲線單位
  function toCurve(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pxPerUnit = rect.width / MAX
    return {
      x: (e.clientX - rect.left) / pxPerUnit,
      y: MAX - (e.clientY - rect.top) / pxPerUnit,
      pxPerUnit,
    }
  }

  function nearestPoint(x: number, y: number, pxPerUnit: number) {
    let best: number | null = null
    let bestDistance = HIT_RADIUS
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - x, points[i][1] - y) * pxPerUnit
      if (d <= bestDistance) {
        best = i
        bestDistance = d
      }
    }
    return best
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    const { x, y, pxPerUnit } = toCurve(e)
    let index = nearestPoint(x, y, pxPerUnit)
    let next = points

    if (index === null) {
      const newX = Math.round(clamp(x, 0, MAX))
      if (points.some((p) => p[0] === newX)) return
      next = [...points, [newX, Math.round(clamp(y, 0, MAX))] as CurvePoint].sort((a, b) => a[0] - b[0])
      index = next.findIndex((p) => p[0] === newX)
      onChange(next)
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { index, points: next, removed: false }
    onSelect(index)
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const { x, y, pxPerUnit } = toCurve(e)
    const last = d.points.length - 1
    const isEndpoint = d.index === 0 || d.index === last
    const outside = Math.max(-y, y - MAX) * pxPerUnit

    if (!isEndpoint && outside > REMOVE_DISTANCE) {
      if (!d.removed) {
        d.removed = true
        onChange(d.points.filter((_, i) => i !== d.index))
        onSelect(null)
      }
      return
    }

    const minX = d.index === 0 ? 0 : d.points[d.index - 1][0] + 1
    const maxX = d.index === last ? MAX : d.points[d.index + 1][0] - 1
    const moved: CurvePoint = [Math.round(clamp(x, minX, maxX)), Math.round(clamp(y, 0, MAX))]
    d.points = d.points.map((p, i) => (i === d.index ? moved : p))
    if (d.removed) {
      d.removed = false
      onSelect(d.index)
    }
    onChange(d.points)
  }

  function handlePointerUp() {
    if (!drag.current) return
    drag.current = null
    onCommit()
  }

  function handleDoubleClick(e: MouseEvent<SVGSVGElement>) {
    const { x, y, pxPerUnit } = toCurve(e)
    const index = nearestPoint(x, y, pxPerUnit)
    if (index === null || index === 0 || index === points.length - 1) return
    onChange(points.filter((_, i) => i !== index))
    onSelect(null)
    onCommit()
  }

  const grid = [MAX / 4, MAX / 2, (MAX * 3) / 4]

  return (
    <svg
      viewBox={`0 0 ${MAX} ${MAX}`}
      role="img"
      aria-label="色調曲線編輯器：點一下新增控制點，拖曳調整，拖出框外或雙擊刪除"
      className="aspect-square w-full cursor-crosshair touch-none overflow-visible select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <rect width={MAX} height={MAX} className="fill-canvas stroke-border" vectorEffect="non-scaling-stroke" />
      {grid.map((v) => (
        <g key={v} className="stroke-border" vectorEffect="non-scaling-stroke">
          <line x1={v} y1={0} x2={v} y2={MAX} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={v} x2={MAX} y2={v} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      <line x1={0} y1={MAX} x2={MAX} y2={0} stroke="white" strokeOpacity={0.12} vectorEffect="non-scaling-stroke" />
      {ghosts.map((g, i) => (
        <path
          key={i}
          d={curvePath(g.curve)}
          fill="none"
          stroke={g.color}
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={curvePath(curve)} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={MAX - y}
          r={i === selected ? 4.5 : 3.5}
          fill={i === selected ? color : 'var(--canvas)'}
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
