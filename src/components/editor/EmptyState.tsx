import { ImagePlus } from 'lucide-react'
import { useT } from '@/i18n/i18n'
import { OpenPhotoButton } from './OpenPhotoButton'

export function EmptyState() {
  const { empty } = useT().editor
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
    </main>
  )
}
