import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CurvePanel } from '@/components/panels/CurvePanel'
import { GradingPanel } from '@/components/panels/GradingPanel'
import { MixerPanel } from '@/components/panels/MixerPanel'
import { PresetPanel } from '@/components/presets/PresetPanel'
import { SliderSection } from './SliderSection'
import {
  GRAIN_SLIDERS,
  PRESENCE_EFFECT_SLIDERS,
  PRESENCE_SLIDERS,
  SHARPEN_SLIDERS,
  TONE_SLIDERS,
  VIGNETTE_SLIDERS,
  WHITE_BALANCE_SLIDERS,
} from './sliders'

const TABS = [
  { value: 'light', label: '光線' },
  { value: 'color', label: '色彩' },
  { value: 'curve', label: '曲線' },
  { value: 'mixer', label: '混色' },
  { value: 'grading', label: '分級' },
  { value: 'effects', label: '效果' },
  { value: 'presets', label: '預設集' },
]

const PANEL = 'overflow-y-auto pb-4'

export function EditPanel() {
  return (
    <aside className="flex h-[54%] shrink-0 flex-col border-t md:h-auto md:w-80 md:border-t-0 md:border-l">
      <Tabs defaultValue="light" className="min-h-0 flex-1 gap-0">
        {/* 手機上 7 個分頁放不下，可以左右滑 */}
        <div className="overflow-x-auto px-3 pt-3 [scrollbar-width:none]">
          <TabsList className="w-max min-w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="light" className={PANEL}>
          <SliderSection title="色調" sliders={TONE_SLIDERS} />
        </TabsContent>
        <TabsContent value="color" className={PANEL}>
          <SliderSection title="白平衡" sliders={WHITE_BALANCE_SLIDERS} />
          <SliderSection title="飽和度" sliders={PRESENCE_SLIDERS} />
        </TabsContent>
        <TabsContent value="curve" className={PANEL}>
          <CurvePanel />
        </TabsContent>
        <TabsContent value="mixer" className={PANEL}>
          <MixerPanel />
        </TabsContent>
        <TabsContent value="grading" className={PANEL}>
          <GradingPanel />
        </TabsContent>
        <TabsContent value="effects" className={PANEL}>
          <SliderSection title="外觀" sliders={PRESENCE_EFFECT_SLIDERS} />
          <SliderSection title="銳利化" sliders={SHARPEN_SLIDERS} />
          <SliderSection title="暗角" sliders={VIGNETTE_SLIDERS} />
          <SliderSection title="顆粒" sliders={GRAIN_SLIDERS} />
        </TabsContent>
        <TabsContent value="presets" className={PANEL}>
          <PresetPanel />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
