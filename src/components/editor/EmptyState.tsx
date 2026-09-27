import { ImagePlus } from 'lucide-react'
import { OpenPhotoButton } from './OpenPhotoButton'

export function EmptyState() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <p className="text-muted-foreground">開啟一張照片開始調色</p>
      <OpenPhotoButton size="lg">
        <ImagePlus />
        開啟照片
      </OpenPhotoButton>
      <p className="text-xs text-muted-foreground">支援 JPEG、PNG、WebP，也可以直接把檔案拖進來</p>
    </main>
  )
}
