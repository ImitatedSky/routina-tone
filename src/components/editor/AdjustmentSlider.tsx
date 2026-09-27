import type { CSSProperties } from 'react'
import { ADJUSTMENT_RANGES, DEFAULT_ADJUSTMENTS, type AdjustmentKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'

interface Props {
  adjKey: AdjustmentKey
  label: string
  // 軌道的 CSS 背景，例如色溫的藍到黃
  track?: string
}

// 小數位數跟著滑桿的 step；只有能往負的滑桿才顯示 + 號
function formatValue(key: AdjustmentKey, value: number) {
  const { step, min } = ADJUSTMENT_RANGES[key]
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const text = value.toFixed(decimals)
  return min < 0 && value > 0 ? `+${text}` : text
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
