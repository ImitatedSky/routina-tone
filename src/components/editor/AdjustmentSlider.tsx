import type { CSSProperties } from 'react'
import { ADJUSTMENT_RANGES, DEFAULT_ADJUSTMENTS, type AdjustmentKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'

interface Props {
  adjKey: AdjustmentKey
  label: string
  // 軌道的 CSS 背景，例如色溫的藍到黃
  track?: string
}

function formatValue(key: AdjustmentKey, value: number) {
  const text = key === 'exposure' ? value.toFixed(2) : String(Math.round(value))
  return value > 0 ? `+${text}` : text
}

// 雙擊可歸零；放開才提交，一次拖曳只算一步 undo
export function AdjustmentSlider({ adjKey, label, track }: Props) {
  const value = useEditor((s) => s.adjustments[adjKey])
  const setAdjustment = useEditor((s) => s.setAdjustment)
  const commit = useEditor((s) => s.commit)
  const { min, max, step } = ADJUSTMENT_RANGES[adjKey]

  function reset() {
    setAdjustment(adjKey, DEFAULT_ADJUSTMENTS[adjKey])
    commit()
  }

  return (
    <div className="py-1.5" onDoubleClick={reset}>
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={`adj-${adjKey}`} className="text-muted-foreground">
          {label}
        </label>
        <span className="tabular-nums">{formatValue(adjKey, value)}</span>
      </div>
      <input
        id={`adj-${adjKey}`}
        type="range"
        className="tone-range"
        style={track ? ({ '--track': track } as CSSProperties) : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setAdjustment(adjKey, Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  )
}
