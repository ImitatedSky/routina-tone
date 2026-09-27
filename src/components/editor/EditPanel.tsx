import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PresetPanel } from '@/components/presets/PresetPanel'
import { SliderSection } from './SliderSection'
import { PRESENCE_SLIDERS, TONE_SLIDERS, WHITE_BALANCE_SLIDERS } from './sliders'

export function EditPanel() {
  return (
    <aside className="flex h-[44%] shrink-0 flex-col border-t md:h-auto md:w-80 md:border-t-0 md:border-l">
      <Tabs defaultValue="light" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 mt-3 w-auto">
          <TabsTrigger value="light">光線</TabsTrigger>
          <TabsTrigger value="color">色彩</TabsTrigger>
          <TabsTrigger value="presets">預設集</TabsTrigger>
        </TabsList>
        <TabsContent value="light" className="overflow-y-auto pb-4">
          <SliderSection title="色調" sliders={TONE_SLIDERS} />
        </TabsContent>
        <TabsContent value="color" className="overflow-y-auto pb-4">
          <SliderSection title="白平衡" sliders={WHITE_BALANCE_SLIDERS} />
          <SliderSection title="飽和度" sliders={PRESENCE_SLIDERS} />
        </TabsContent>
        <TabsContent value="presets" className="overflow-y-auto pb-4">
          <PresetPanel />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
