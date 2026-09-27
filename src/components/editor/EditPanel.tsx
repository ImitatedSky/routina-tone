import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CropPanel } from '@/components/crop/CropPanel'
import { MaskPanel } from '@/components/masks/MaskPanel'
import { CurvePanel } from '@/components/panels/CurvePanel'
import { GradingPanel } from '@/components/panels/GradingPanel'
import { MixerPanel } from '@/components/panels/MixerPanel'
import { PresetPanel } from '@/components/presets/PresetPanel'
import { useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { SliderSection } from './SliderSection'
import {
  GRAIN_SLIDERS,
  PRESENCE_EFFECT_SLIDERS,
  PRESENCE_SLIDERS,
  SHARPEN_SLIDERS,
  TONE_SLIDERS,
  VIGNETTE_SLIDERS,
  WHITE_BALANCE_SLIDERS,
  withLabels,
} from './sliders'

const TABS = ['light', 'color', 'curve', 'mixer', 'grading', 'effects', 'masks', 'crop', 'presets'] as const

const PANEL = 'overflow-y-auto pb-4'

export function EditPanel() {
  const t = useT()
  const { sections } = t.editor
  const setCropMode = useView((s) => s.setCropMode)
  const setMaskMode = useView((s) => s.setMaskMode)

  return (
    <aside className="flex h-[54%] shrink-0 flex-col border-t md:h-auto md:w-80 md:border-t-0 md:border-l">
      <Tabs
        defaultValue="light"
        className="min-h-0 flex-1 gap-0"
        onValueChange={(value) => {
          setCropMode(value === 'crop')
          setMaskMode(value === 'masks')
        }}
      >
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
