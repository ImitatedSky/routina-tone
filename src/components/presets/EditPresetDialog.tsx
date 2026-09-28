import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useT } from '@/i18n/i18n'
import { normalizeGroup } from '@/presets/presetFile'
import type { Preset } from '@/storage/db'
import { GroupInput } from './GroupInput'

interface Props {
  preset: Preset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: string[]
  onSave: (preset: Preset, name: string, group: string) => Promise<void>
}

// 改預設集的名稱與群組
export function EditPresetDialog({ preset, open, onOpenChange, groups, onSave }: Props) {
  const m = useT().presets
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.editTitle}</DialogTitle>
        </DialogHeader>
        {/* 對話框關掉時內容會卸載，每次打開都從預設集目前的值開始 */}
        {preset && (
          <EditForm
            preset={preset}
            groups={groups}
            onSave={async (name, group) => {
              await onSave(preset, name, group)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface FormProps {
  preset: Preset
  groups: string[]
  onSave: (name: string, group: string) => Promise<void>
}

function EditForm({ preset, groups, onSave }: FormProps) {
  const m = useT()
  const [name, setName] = useState(preset.name)
  const [group, setGroup] = useState(preset.group)
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const groupId = useId()
  const hintId = useId()

  async function submit() {
    setBusy(true)
    try {
      await onSave(name.trim(), normalizeGroup(group))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={nameId} className="text-xs text-muted-foreground">
          {m.presets.nameLabel}
        </label>
        <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={groupId} className="text-xs text-muted-foreground">
          {m.presets.groupLabel}
        </label>
        <GroupInput id={groupId} aria-describedby={hintId} value={group} onChange={setGroup} groups={groups} />
        <p id={hintId} className="text-xs text-muted-foreground">
          {m.presets.groupHint}
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!name.trim() || busy}>
          {m.common.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
