import { useState } from 'react'
import { ChevronRight, Copy, Download, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { Preset } from '@/storage/db'

interface Props {
  presets: Preset[]
  // 群組名稱，已排序
  groups: string[]
  onApply: (preset: Preset) => void
  onEdit: (preset: Preset) => void
  onCopy: (preset: Preset) => void
  onExport: (preset: Preset) => void
  onDelete: (preset: Preset) => void
}

type RowActions = Omit<Props, 'presets' | 'groups'>

const COLLAPSED_KEY = 'tone-preset-collapsed-groups'

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

// 沒分組的放最上面，接著每個群組一段，可以收合
export function PresetList({ presets, groups, ...actions }: Props) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const ungrouped = presets.filter((p) => !p.group)

  function toggle(group: string) {
    const next = new Set(collapsed)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    setCollapsed(next)
    saveCollapsed(next)
  }

  return (
    <div className="space-y-2">
      {ungrouped.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {ungrouped.map((preset) => (
            <PresetRow key={preset.id} preset={preset} {...actions} />
          ))}
        </ul>
      )}
      {groups.map((group) => {
        const items = presets.filter((p) => p.group === group)
        const open = !collapsed.has(group)
        return (
          <section key={group} className="rounded-lg border">
            <button
              type="button"
              aria-expanded={open}
              className="flex w-full items-center gap-1.5 px-2 py-2 text-left text-sm font-medium hover:text-primary pointer-coarse:py-2.5"
              onClick={() => toggle(group)}
            >
              <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
              <span className="min-w-0 flex-1 truncate">{group}</span>
              <span className="shrink-0 pr-1 text-xs text-muted-foreground tabular-nums">{items.length}</span>
            </button>
            {open && (
              <ul className="divide-y border-t">
                {items.map((preset) => (
                  <PresetRow key={preset.id} preset={preset} {...actions} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function PresetRow({ preset, onApply, onEdit, onCopy, onExport, onDelete }: RowActions & { preset: Preset }) {
  const m = useT().presets
  return (
    <li className="flex items-center pr-1">
      <button
        type="button"
        className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm hover:text-primary"
        onClick={() => onApply(preset)}
      >
        {preset.name}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label={m.editPreset(preset.name)} onClick={() => onEdit(preset)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={m.copyPreset(preset.name)} onClick={() => onCopy(preset)}>
        <Copy />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={m.exportPreset(preset.name)} onClick={() => onExport(preset)}>
        <Download />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={m.deletePreset(preset.name)} onClick={() => onDelete(preset)}>
        <Trash2 />
      </Button>
    </li>
  )
}
