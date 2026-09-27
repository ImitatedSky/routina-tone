import { useState } from 'react'
import { ImagePlus, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/i18n'
import { BatchDialog } from './BatchDialog'
import { OpenPhotoButton } from './OpenPhotoButton'

export function EmptyState() {
  const t = useT()
  const { empty } = t.editor
  const [batchOpen, setBatchOpen] = useState(false)
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <p className="text-muted-foreground">{empty.prompt}</p>
      <OpenPhotoButton size="lg">
        <ImagePlus />
        {empty.open}
      </OpenPhotoButton>
      <p className="text-xs text-muted-foreground">
        {empty.formats}
        <span className="hidden md:inline">{empty.dragHint}</span>
      </p>
      <Button variant="ghost" size="sm" onClick={() => setBatchOpen(true)}>
        <Images />
        {t.editor.batch.open}
      </Button>
      <BatchDialog open={batchOpen} onOpenChange={setBatchOpen} />
    </main>
  )
}
