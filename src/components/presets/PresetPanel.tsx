import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Copy, Download, FileUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isDefault } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { t, useT } from '@/i18n/i18n'
import { copyText } from '@/lib/clipboard'
import { safeFilename } from '@/lib/download'
import { saveFile } from '@/lib/saveFile'
import { PRESET_EXTENSION, parsePresetFile, serializePreset } from '@/presets/presetFile'
import { parseXmpPreset } from '@/presets/xmp'
import { addPreset, deletePreset, listPresets, putPreset, type Preset } from '@/storage/db'
import { PasteImportDialog } from './PasteImportDialog'

export function PresetPanel() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [name, setName] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const current = useEditor((s) => s.adjustments)
  const apply = useEditor((s) => s.apply)
  const m = useT()

  async function refresh() {
    setPresets(await listPresets())
  }

  useEffect(() => {
    listPresets().then(setPresets, () => toast.error(t().presets.loadFailed))
  }, [])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    await addPreset(trimmed, current)
    setName('')
    await refresh()
    toast.success(m.presets.saved(trimmed))
  }

  async function remove(preset: Preset) {
    await deletePreset(preset.id)
    await refresh()
    toast(m.presets.deleted(preset.name), {
      action: {
        label: m.presets.undo,
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
      toast.error(error instanceof Error ? error.message : m.presets.exportFailed)
    }
  }

  async function copyOne(preset: Preset) {
    const ok = await copyText(serializePreset(preset.name, preset.adjustments))
    if (ok) toast.success(m.presets.copied)
    else toast.error(m.presets.copyFailed)
  }

  // 一份預設集的文字：.xmp 是 XML（以 < 開頭），其他當成我們的 JSON。失敗時丟出錯誤
  async function importText(text: string, fileName: string) {
    if (/\.xmp$/i.test(fileName) || text.trimStart().startsWith('<')) {
      const { name: presetName, adjustments, warnings } = parseXmpPreset(text, fileName)
      await addPreset(presetName, adjustments)
      if (warnings.length > 0) {
        toast.warning(m.presets.partiallyApplied(presetName), {
          description: warnings.join(m.presets.listSeparator),
        })
      }
    } else {
      const { name: presetName, adjustments } = parsePresetFile(text)
      await addPreset(presetName, adjustments)
    }
  }

  async function importPasted(text: string): Promise<boolean> {
    try {
      await importText(text, '')
      await refresh()
      toast.success(m.presets.imported(1))
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.presets.pasteFailed)
      return false
    }
  }

  async function importFiles(files: FileList) {
    let imported = 0
    for (const file of Array.from(files)) {
      try {
        await importText(await file.text(), file.name)
        imported++
      } catch (error) {
        toast.error(m.presets.importFileError(file.name, error instanceof Error ? error.message : m.presets.importFailed))
      }
    }
    if (imported > 0) {
      await refresh()
      toast.success(m.presets.imported(imported))
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
        <Input placeholder={m.presets.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="default" disabled={!name.trim() || isDefault(current)}>
          <Plus />
          {m.common.save}
        </Button>
      </form>

      <div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <FileUp />
            {m.presets.importFile}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste />
            {m.presets.importPaste}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">{m.presets.importHint}</p>
      </div>
      <PasteImportDialog open={pasteOpen} onOpenChange={setPasteOpen} onImport={importPasted} />
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
        <p className="py-4 text-center text-xs text-muted-foreground">{m.presets.empty}</p>
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
              <Button variant="ghost" size="icon-sm" aria-label={m.presets.copyPreset(preset.name)} onClick={() => void copyOne(preset)}>
                <Copy />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={m.presets.exportPreset(preset.name)} onClick={() => void exportOne(preset)}>
                <Download />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={m.presets.deletePreset(preset.name)} onClick={() => void remove(preset)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
