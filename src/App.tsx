import { Toaster } from '@/components/ui/sonner'
import { EditPanel } from '@/components/editor/EditPanel'
import { EmptyState } from '@/components/editor/EmptyState'
import { PhotoCanvas } from '@/components/editor/PhotoCanvas'
import { Toolbar } from '@/components/editor/Toolbar'
import { useEditor } from '@/editor/editorStore'
import { openPhotoFile } from '@/editor/openPhoto'
import { useSessionPersistence } from '@/editor/useSessionPersistence'
import { useShortcuts } from '@/editor/useShortcuts'

export function App() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const restoring = useSessionPersistence()
  useShortcuts()

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) void openPhotoFile(file)
      }}
    >
      <Toolbar />
      {hasPhoto ? (
        <main className="flex min-h-0 flex-1 flex-col md:flex-row">
          <PhotoCanvas />
          <EditPanel />
        </main>
      ) : (
        !restoring && <EmptyState />
      )}
      <Toaster position="top-center" />
    </div>
  )
}
