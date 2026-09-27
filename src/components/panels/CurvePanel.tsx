import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SliderSection, type SliderDef } from '@/components/editor/SliderSection'
import { CURVE_CHANNELS, DEFAULT_CURVE, isIdentityCurve, type CurveChannel } from '@/engine/adjustments'
import { parametricCurve, pointCurve } from '@/engine/curves'
import { useEditor } from '@/editor/editorStore'
import { cn } from '@/lib/utils'
import { CurveEditor, type GhostCurve } from './CurveEditor'

const CHANNELS: Record<CurveChannel, { label: string; color: string }> = {
  rgb: { label: 'RGB', color: 'oklch(0.93 0 0)' },
  red: { label: '紅', color: 'oklch(0.68 0.2 25)' },
  green: { label: '綠', color: 'oklch(0.75 0.17 145)' },
  blue: { label: '藍', color: 'oklch(0.68 0.16 255)' },
}

const REGION_SLIDERS: SliderDef[] = [
  { key: 'curveHighlights', label: '亮部' },
  { key: 'curveLights', label: '亮調' },
  { key: 'curveDarks', label: '暗調' },
  { key: 'curveShadows', label: '陰影' },
]

const SPLIT_SLIDERS: SliderDef[] = [
  { key: 'curveShadowSplit', label: '陰影分界' },
  { key: 'curveMidtoneSplit', label: '中間分界' },
  { key: 'curveHighlightSplit', label: '亮部分界' },
]

export function CurvePanel() {
  const [channel, setChannel] = useState<CurveChannel>('rgb')
  const [selected, setSelected] = useState<number | null>(null)
  const adjustments = useEditor((s) => s.adjustments)
  const setCurve = useEditor((s) => s.setCurve)
  const commit = useEditor((s) => s.commit)

  const points = adjustments.curve[channel]
  // undo 之後點的數量可能變了
  const selectedPoint = selected !== null ? points[selected] : undefined
  const isEndpoint = selected === 0 || selected === points.length - 1

  // RGB 頻道畫的是參數式曲線再套點曲線，拉區域滑桿時才看得到效果
  const parametric = parametricCurve(adjustments)
  const rgb = pointCurve(adjustments.curve.rgb)
  const masterCurve = (x: number) => rgb(parametric(x / 255) * 255)
  const masterChanged =
    !isIdentityCurve(adjustments.curve.rgb) || REGION_SLIDERS.some(({ key }) => adjustments[key] !== 0)

  const curve = channel === 'rgb' ? masterCurve : pointCurve(points)
  const ghosts: GhostCurve[] = []
  for (const c of CURVE_CHANNELS) {
    if (c === channel) continue
    if (c === 'rgb') {
      if (masterChanged) ghosts.push({ color: CHANNELS.rgb.color, curve: masterCurve })
    } else if (!isIdentityCurve(adjustments.curve[c])) {
      ghosts.push({ color: CHANNELS[c].color, curve: pointCurve(adjustments.curve[c]) })
    }
  }

  function selectChannel(c: CurveChannel) {
    setChannel(c)
    setSelected(null)
  }

  function reset() {
    setCurve(channel, DEFAULT_CURVE[channel])
    commit()
    setSelected(null)
  }

  function removeSelected() {
    if (selected === null || isEndpoint) return
    setCurve(channel, points.filter((_, i) => i !== selected))
    commit()
    setSelected(null)
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="曲線頻道">
          {CURVE_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === channel}
              onClick={() => selectChannel(c)}
              className={cn(
                'flex h-7 min-w-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors',
                c === channel && 'bg-background text-foreground shadow-sm',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: CHANNELS[c].color }} />
              {CHANNELS[c].label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" disabled={isIdentityCurve(points)} onClick={reset}>
          重設
        </Button>
      </div>

      <div className="px-4 py-2">
        <div className="mx-auto max-w-80">
          <CurveEditor
            points={points}
            color={CHANNELS[channel].color}
            curve={curve}
            ghosts={ghosts}
            selected={selectedPoint ? selected : null}
            onSelect={setSelected}
            onChange={(next) => setCurve(channel, next)}
            onCommit={commit}
          />
        </div>
        <div className="mt-2 flex h-7 items-center justify-between text-xs">
          {selectedPoint ? (
            <>
              <span className="text-muted-foreground tabular-nums">
                輸入 <span className="text-foreground">{selectedPoint[0]}</span> → 輸出{' '}
                <span className="text-foreground">{selectedPoint[1]}</span>
              </span>
              <Button variant="ghost" size="xs" disabled={isEndpoint} onClick={removeSelected}>
                刪除
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">點一下曲線新增控制點</span>
          )}
        </div>
      </div>

      <SliderSection title="區域" sliders={REGION_SLIDERS} />
      <SliderSection title="分界點" sliders={SPLIT_SLIDERS} />
    </div>
  )
}
