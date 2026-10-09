import { ChevronLeft, Grid3x3, type LucideIcon } from 'lucide-react'
import { PixelPanel } from '@/components/pixel/PixelPanel'
import { Button } from '@/components/ui/button'
import { useView, type Tool } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

const ICONS: Record<Tool, LucideIcon> = { pixel: Grid3x3 }

// 工具頁：沒選工具時列出所有工具，點了就換成那個工具的設定
export function ToolsPanel() {
  const t = useT()
  const collapsed = useView((s) => s.panelCollapsed)
  const tool = useView((s) => s.tool)
  const setTool = useView((s) => s.setTool)
  const cards: Record<Tool, { title: string; summary: string }> = { pixel: t.pixel }

  return (
    <aside className={cn('flex h-[54%] shrink-0 flex-col md:h-auto md:w-80', collapsed && 'hidden')}>
      {tool ? (
        <>
          <div className="flex items-center gap-1 px-2 pt-3">
            <Button variant="ghost" size="icon" aria-label={t.editor.tools.back} onClick={() => setTool(null)}>
              <ChevronLeft />
            </Button>
            <h2 className="text-sm font-medium">{cards[tool].title}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">{tool === 'pixel' && <PixelPanel />}</div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="grid gap-2">
            {(Object.keys(ICONS) as Tool[]).map((id) => {
              const Icon = ICONS[id]
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTool(id)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{cards[id].title}</span>
                      <span className="block text-xs text-muted-foreground">{cards[id].summary}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}
