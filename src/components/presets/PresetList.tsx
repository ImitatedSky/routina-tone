import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Copy, Download, EllipsisVertical, Pencil, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PresetSections } from '@/presets/ordering'
import type { Preset } from '@/storage/db'

export interface RowActions {
  onApply: (preset: Preset) => void
  onToggleFavorite: (preset: Preset) => void
  onEdit: (preset: Preset) => void
  onCopy: (preset: Preset) => void
  onExport: (preset: Preset) => void
  onDelete: (preset: Preset) => void
}

interface Props extends RowActions {
  sections: PresetSections
  // 調整順序模式：每一列與每個群組標題多出上下箭頭
  reordering: boolean
  onMovePreset: (section: Preset[], preset: Preset, direction: -1 | 1) => void
  onMoveGroup: (group: string, direction: -1 | 1) => void
}

// 收合狀態存在 localStorage。常用與未分組用固定的 key，不會和使用者的群組名稱撞到
const COLLAPSED_KEY = 'tone-preset-collapsed-groups'
const FAVORITES = '\u0000favorites'
const UNGROUPED = '\u0000ungrouped'

function loadCollapsed(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    // 無痕模式等存不了就算了，只是下次不會記得
  }
}

// 順序：★ 常用、各群組（依使用者排的順序）、未分組
export function PresetList({ sections, reordering, onMovePreset, onMoveGroup, ...actions }: Props) {
  const m = useT().presets
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  function toggle(key: string) {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
    saveCollapsed(next)
  }

  function section(key: string, title: ReactNode, items: Preset[], options: { highlight?: boolean; groupIndex?: number } = {}) {
    if (items.length === 0) return null
    const open = !collapsed.has(key)
    const { groupIndex } = options
    const isGroup = groupIndex !== undefined
    return (
      <section key={key} className={cn('rounded-lg border', options.highlight && 'border-amber-400/40 bg-amber-400/5')}>
        <div className="flex items-center pr-1">
          <button
            type="button"
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left text-sm font-medium hover:text-primary pointer-coarse:py-2.5"
            onClick={() => toggle(key)}
          >
            <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <span className="shrink-0 pr-1 text-xs text-muted-foreground tabular-nums">{items.length}</span>
          </button>
          {reordering && isGroup && (
            <MoveButtons
              name={key}
              canUp={groupIndex > 0}
              canDown={groupIndex < sections.groups.length - 1}
              onMove={(d) => onMoveGroup(key, d)}
            />
          )}
        </div>
        {open && (
          <ul className="divide-y border-t">
            {items.map((preset, i) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                reorder={
                  reordering
                    ? { canUp: i > 0, canDown: i < items.length - 1, onMove: (d) => onMovePreset(items, preset, d) }
                    : undefined
                }
                {...actions}
              />
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-2">
      {section(
        FAVORITES,
        <span className="flex items-center gap-1.5">
          <Star className="size-4 fill-amber-400 text-amber-400" />
          {m.favorites}
        </span>,
        sections.favorites,
        { highlight: true },
      )}
      {sections.groups.map((g, i) => section(g.name, g.name, g.presets, { groupIndex: i }))}
      {section(UNGROUPED, <span className="text-muted-foreground">{m.ungrouped}</span>, sections.ungrouped)}
    </div>
  )
}

function MoveButtons({ name, canUp, canDown, onMove }: { name: string; canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void }) {
  const m = useT().presets
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={m.moveUp(name)} disabled={!canUp} onClick={() => onMove(-1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={m.moveDown(name)} disabled={!canDown} onClick={() => onMove(1)}>
        <ArrowDown />
      </Button>
    </>
  )
}

interface RowProps extends RowActions {
  preset: Preset
  reorder?: { canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void }
}

function PresetRow({ preset, reorder, onApply, onToggleFavorite, onEdit, onCopy, onExport, onDelete }: RowProps) {
  const t = useT()
  const m = t.presets
  return (
    <li className="flex items-center pr-1">
      <button
        type="button"
        className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm hover:text-primary"
        onClick={() => onApply(preset)}
      >
        {preset.name}
      </button>
      {reorder ? (
        <MoveButtons name={preset.name} canUp={reorder.canUp} canDown={reorder.canDown} onMove={reorder.onMove} />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={preset.favorite ? m.unfavorite(preset.name) : m.favorite(preset.name)}
            aria-pressed={preset.favorite}
            onClick={() => onToggleFavorite(preset)}
          >
            <Star className={cn(preset.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
          </Button>
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={m.moreActions(preset.name)} />}
            >
              <EllipsisVertical />
            </MenuTrigger>
            <MenuContent>
              <MenuItem onClick={() => onEdit(preset)}>
                <Pencil />
                {m.edit}
              </MenuItem>
              <MenuItem onClick={() => onCopy(preset)}>
                <Copy />
                {m.copy}
              </MenuItem>
              <MenuItem onClick={() => onExport(preset)}>
                <Download />
                {m.export}
              </MenuItem>
              <MenuItem variant="destructive" onClick={() => onDelete(preset)}>
                <Trash2 />
                {t.common.delete}
              </MenuItem>
            </MenuContent>
          </Menu>
        </>
      )}
    </li>
  )
}
