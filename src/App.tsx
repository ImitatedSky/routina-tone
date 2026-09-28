import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { EditPanel } from '@/components/editor/EditPanel'
import { EmptyState } from '@/components/editor/EmptyState'
import { PanelToggle } from '@/components/editor/PanelToggle'
import { PhotoCanvas } from '@/components/editor/PhotoCanvas'
import { Toolbar } from '@/components/editor/Toolbar'
import { useEditor } from '@/editor/editorStore'
import { openPhotoFile } from '@/editor/openPhoto'
import { useSessionPersistence } from '@/editor/useSessionPersistence'
import { useShortcuts } from '@/editor/useShortcuts'
import { useLanguage, useT } from '@/i18n/i18n'

export function App() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const restoring = useSessionPersistence()
  useShortcuts()
  const locale = useLanguage((s) => s.locale)
  const title = useT().common.appTitle

  // 讓瀏覽器、螢幕閱讀器知道目前的語言
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = title
  }, [locale, title])

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
          <PanelToggle />
          <EditPanel />
        </main>
      ) : (
        !restoring && <EmptyState />
      )}
      <Toaster position="top-center" />
    </div>
  )
}
