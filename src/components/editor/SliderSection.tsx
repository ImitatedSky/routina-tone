import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEFAULT_ADJUSTMENTS, type AdjustmentKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { AdjustmentSlider } from './AdjustmentSlider'

export interface SliderDef {
  key: AdjustmentKey
  label: string
  track?: string
}

// 一組滑桿，加上「重設這一區」
export function SliderSection({ title, sliders }: { title: string; sliders: SliderDef[] }) {
  const isChanged = useEditor((s) => sliders.some(({ key }) => s.adjustments[key] !== DEFAULT_ADJUSTMENTS[key]))

  function reset() {
    const { adjustments, apply } = useEditor.getState()
    const next = { ...adjustments }
    for (const { key } of sliders) next[key] = DEFAULT_ADJUSTMENTS[key]
    apply(next)
  }

  return (
    <section className="px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button variant="ghost" size="icon-sm" aria-label={`重設${title}`} disabled={!isChanged} onClick={reset}>
          <RotateCcw />
        </Button>
      </div>
      {sliders.map((s) => (
        <AdjustmentSlider key={s.key} adjKey={s.key} label={s.label} track={s.track} />
      ))}
    </section>
  )
}
