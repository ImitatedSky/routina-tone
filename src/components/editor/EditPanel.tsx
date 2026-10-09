import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CropPanel } from '@/components/crop/CropPanel'
import { MaskPanel } from '@/components/masks/MaskPanel'
import { CurvePanel } from '@/components/panels/CurvePanel'
import { GradingPanel } from '@/components/panels/GradingPanel'
import { MixerPanel } from '@/components/panels/MixerPanel'
import { PresetPanel } from '@/components/presets/PresetPanel'
import { useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SliderSection } from './SliderSection'
import {
  GRAIN_SLIDERS,
  NOISE_SLIDERS,
  PRESENCE_EFFECT_SLIDERS,
  PRESENCE_SLIDERS,
  SHARPEN_SLIDERS,
  TONE_SLIDERS,
  VIGNETTE_SLIDERS,
  WHITE_BALANCE_SLIDERS,
  withLabels,
} from './sliders'

const TABS = ['light', 'color', 'curve', 'mixer', 'grading', 'effects', 'masks', 'crop', 'presets'] as const
type Tab = (typeof TABS)[number]

const PANEL = 'overflow-y-auto pb-4'

export function EditPanel() {
  const t = useT()
  const { sections } = t.editor
  const setCropMode = useView((s) => s.setCropMode)
  const setMaskMode = useView((s) => s.setMaskMode)
  // 收起或切到工具頁時只隱藏、不卸載，分頁與捲動位置才會留著
  const collapsed = useView((s) => s.panelCollapsed)
  const active = useView((s) => s.workspace === 'develop')
  const [tab, setTab] = useState<Tab>('light')

  // 裁切框、遮罩把手只在調色頁的那個分頁顯示
  useEffect(() => {
    setCropMode(active && tab === 'crop')
    setMaskMode(active && tab === 'masks')
  }, [active, tab, setCropMode, setMaskMode])

  return (
    <aside className={cn('flex h-[54%] shrink-0 flex-col md:h-auto md:w-80', (collapsed || !active) && 'hidden')}>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="min-h-0 flex-1 gap-0">
        {/* 手機上分頁放不下，可以左右滑 */}
        <div className="overflow-x-auto px-3 pt-3 [scrollbar-width:none]">
          <TabsList className="w-max min-w-full">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="px-2.5">
                {t.editor.tabs[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="light" className={PANEL}>
          <SliderSection title={sections.tone} sliders={withLabels(TONE_SLIDERS, t)} />
        </TabsContent>
        <TabsContent value="color" className={PANEL}>
          <SliderSection title={sections.whiteBalance} sliders={withLabels(WHITE_BALANCE_SLIDERS, t)} />
          <SliderSection title={sections.presence} sliders={withLabels(PRESENCE_SLIDERS, t)} />
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
          <SliderSection title={sections.appearance} sliders={withLabels(PRESENCE_EFFECT_SLIDERS, t)} />
          <SliderSection title={sections.sharpening} sliders={withLabels(SHARPEN_SLIDERS, t)} />
          <SliderSection title={sections.noiseReduction} sliders={withLabels(NOISE_SLIDERS, t)} />
          <SliderSection title={sections.vignette} sliders={withLabels(VIGNETTE_SLIDERS, t)} />
          <SliderSection title={sections.grain} sliders={withLabels(GRAIN_SLIDERS, t)} />
        </TabsContent>
        <TabsContent value="masks" className={PANEL}>
          <MaskPanel />
        </TabsContent>
        <TabsContent value="crop" className={PANEL}>
          <CropPanel />
        </TabsContent>
        <TabsContent value="presets" className={PANEL}>
          <PresetPanel />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
