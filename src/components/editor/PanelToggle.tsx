import { useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

// 照片與操作面板中間的長條：手機上是橫的（▼ 收到下面），桌機上是直的（▶ 收到右邊）。
// 收起後箭頭反過來，再按一次展開
export function PanelToggle() {
  const t = useT()
  const collapsed = useView((s) => s.panelCollapsed)
  const setCollapsed = useView((s) => s.setPanelCollapsed)
  const label = collapsed ? t.editor.panel.expand : t.editor.panel.collapse

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      onClick={() => setCollapsed(!collapsed)}
      className="group flex h-7 shrink-0 items-center justify-center border-t bg-background text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground md:h-auto md:w-5 md:border-t-0 md:border-l pointer-coarse:h-9"
    >
      <svg
        viewBox="0 0 12 8"
        aria-hidden
        className={cn(
          'h-2 w-3 fill-current transition-transform',
          // 手機：展開時朝下、收起時朝上；桌機：展開時朝右、收起時朝左
          collapsed ? 'rotate-180 md:rotate-90' : 'md:-rotate-90',
        )}
      >
        <path d="M0 0h12L6 8z" />
      </svg>
    </button>
  )
}
