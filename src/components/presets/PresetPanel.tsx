import { useEffect, useRef, useState } from 'react'
import { Download, FileUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isDefault } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { safeFilename } from '@/lib/download'
import { saveFile } from '@/lib/saveFile'
import { PRESET_EXTENSION, parsePresetFile, serializePreset } from '@/presets/presetFile'
import { parseXmpPreset } from '@/presets/xmp'
import { addPreset, deletePreset, listPresets, putPreset, type Preset } from '@/storage/db'

export function PresetPanel() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [name, setName] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const current = useEditor((s) => s.adjustments)
  const apply = useEditor((s) => s.apply)

  async function refresh() {
    setPresets(await listPresets())
  }

  useEffect(() => {
    listPresets().then(setPresets, () => toast.error('讀取預設集失敗'))
  }, [])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    await addPreset(trimmed, current)
    setName('')
    await refresh()
    toast.success(`已儲存「${trimmed}」`)
  }

  async function remove(preset: Preset) {
    await deletePreset(preset.id)
    await refresh()
    toast(`已刪除「${preset.name}」`, {
      action: {
        label: '復原',
        onClick: () => void putPreset(preset).then(refresh),
      },
    })
  }

  async function exportOne(preset: Preset) {
    const blob = new Blob([serializePreset(preset.name, preset.adjustments)], { type: 'application/json' })
    try {
      const saved = await saveFile(blob, safeFilename(preset.name) + PRESET_EXTENSION, 'document')
      if (saved.status === 'saved' && saved.message) toast.success(saved.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '匯出失敗')
    }
  }

  async function importFiles(files: FileList) {
    let imported = 0
    for (const file of Array.from(files)) {
      try {
        const text = await file.text()
        if (/\.xmp$/i.test(file.name)) {
          const { name: presetName, adjustments, warnings } = parseXmpPreset(text, file.name)
          await addPreset(presetName, adjustments)
          if (warnings.length > 0) {
            toast.warning(`「${presetName}」有部分內容無法套用`, { description: warnings.join('、') })
          }
        } else {
          const { name: presetName, adjustments } = parsePresetFile(text)
          await addPreset(presetName, adjustments)
        }
        imported++
      } catch (error) {
        toast.error(`${file.name}：${error instanceof Error ? error.message : '無法匯入'}`)
      }
    }
    if (imported > 0) {
      await refresh()
      toast.success(`已匯入 ${imported} 個預設集`)
    }
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Input placeholder="為目前設定命名" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="default" disabled={!name.trim() || isDefault(current)}>
          <Plus />
          儲存
        </Button>
      </form>

      <Button variant="outline" size="sm" className="w-full" onClick={() => importRef.current?.click()}>
        <FileUp />
        匯入預設集（.tone.json 或 Lightroom .xmp）
      </Button>
      <input
        ref={importRef}
        type="file"
        accept=".json,.xmp,application/json,application/rdf+xml"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) void importFiles(files).finally(() => (e.target.value = ''))
        }}
      />

      {presets.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">還沒有預設集。調好之後在上面命名儲存。</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-1 pr-1">
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm hover:text-primary"
                onClick={() => apply(preset.adjustments)}
              >
                {preset.name}
              </button>
              <Button variant="ghost" size="icon-sm" aria-label={`匯出「${preset.name}」`} onClick={() => void exportOne(preset)}>
                <Download />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`刪除「${preset.name}」`} onClick={() => void remove(preset)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
