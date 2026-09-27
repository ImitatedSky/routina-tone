import { ADJUSTMENT_RANGES, DEFAULT_ADJUSTMENTS, type AdjustmentKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { TouchSlider } from './TouchSlider'

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

// 接到編輯狀態的滑桿：雙擊歸零，放開才提交
export function AdjustmentSlider({ adjKey, label, track }: Props) {
  const value = useEditor((s) => s.adjustments[adjKey])
  const setAdjustment = useEditor((s) => s.setAdjustment)
  const commit = useEditor((s) => s.commit)
  const { min, max, step } = ADJUSTMENT_RANGES[adjKey]

  return (
    <TouchSlider
      id={`adj-${adjKey}`}
      value={value}
      min={min}
      max={max}
      step={step}
      label={label}
      valueText={formatValue(adjKey, value)}
      track={track}
      onChange={(v) => setAdjustment(adjKey, v)}
      onCommit={commit}
      onReset={() => {
        setAdjustment(adjKey, DEFAULT_ADJUSTMENTS[adjKey])
        commit()
      }}
    />
  )
}
