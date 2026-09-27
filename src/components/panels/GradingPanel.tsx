import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdjustmentSlider } from '@/components/editor/AdjustmentSlider'
import { SliderSection, type SliderDef } from '@/components/editor/SliderSection'
import { DEFAULT_ADJUSTMENTS, GRADE_RANGES, type GradeRange, type ScalarKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { ColorWheel } from './ColorWheel'
import { tintColor } from './wheelMath'

const RANGE_LABELS: Record<GradeRange, string> = {
  shadow: '陰影',
  midtone: '中間調',
  highlight: '亮部',
  global: '全局',
}

function gradeKey(range: GradeRange, prop: 'Hue' | 'Sat' | 'Lum') {
  return `grade${range[0].toUpperCase() + range.slice(1)}${prop}` as ScalarKey
}

const BLEND_SLIDERS: SliderDef[] = [
  { key: 'gradeBlending', label: '混合' },
  { key: 'gradeBalance', label: '平衡' },
]

const LUM_TRACK = 'linear-gradient(to right, #1a1a1a, #e6e6e6)'

// 選單上的小圓點，顯示這個範圍目前的色偏
function RangeSwatch({ range }: { range: GradeRange }) {
  const hue = useEditor((s) => s.adjustments[gradeKey(range, 'Hue')])
  const sat = useEditor((s) => s.adjustments[gradeKey(range, 'Sat')])
  return (
    <span
      aria-hidden
      className="size-2 rounded-full border border-white/30"
      style={{ background: sat > 0 ? tintColor(hue, sat) : 'transparent' }}
    />
  )
}

// Lightroom 的色彩分級：陰影／中間調／亮部／全局各有一個色輪和明度
export function GradingPanel() {
  const [range, setRange] = useState<GradeRange>('shadow')
  const hueKey = gradeKey(range, 'Hue')
  const satKey = gradeKey(range, 'Sat')
  const lumKey = gradeKey(range, 'Lum')

  const hue = useEditor((s) => s.adjustments[hueKey])
  const sat = useEditor((s) => s.adjustments[satKey])
  const isChanged = useEditor((s) =>
    [hueKey, satKey, lumKey].some((k) => s.adjustments[k] !== DEFAULT_ADJUSTMENTS[k]),
  )
  const setAdjustment = useEditor((s) => s.setAdjustment)
  const commit = useEditor((s) => s.commit)

  function changeWheel(nextHue: number, nextSat: number) {
    setAdjustment(hueKey, nextHue)
    setAdjustment(satKey, nextSat)
  }

  function resetWheel() {
    changeWheel(DEFAULT_ADJUSTMENTS[hueKey], DEFAULT_ADJUSTMENTS[satKey])
    commit()
  }

  function resetRange() {
    const { adjustments, apply } = useEditor.getState()
    const next = { ...adjustments }
    for (const k of [hueKey, satKey, lumKey]) next[k] = DEFAULT_ADJUSTMENTS[k]
    apply(next)
  }

  const label = RANGE_LABELS[range]

  return (
    <div>
      <Tabs value={range} onValueChange={(v) => setRange(v as GradeRange)} className="px-4 pt-2">
        <TabsList className="w-full">
          {GRADE_RANGES.map((r) => (
            <TabsTrigger key={r} value={r}>
              <RangeSwatch range={r} />
              {RANGE_LABELS[r]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="px-4 py-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{label}</h2>
          <Button variant="ghost" size="icon-sm" aria-label={`重設${label}`} disabled={!isChanged} onClick={resetRange}>
            <RotateCcw />
          </Button>
        </div>
        <ColorWheel
          label={`${label}色輪`}
          hue={hue}
          sat={sat}
          size={280}
          onChange={changeWheel}
          onCommit={commit}
          onReset={resetWheel}
        />
        <AdjustmentSlider key={lumKey} adjKey={lumKey} label="明度" track={LUM_TRACK} />
      </section>

      <SliderSection title="混合與平衡" sliders={BLEND_SLIDERS} />
    </div>
  )
}
