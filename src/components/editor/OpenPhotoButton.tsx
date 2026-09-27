import { useRef, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { openPhotoFile } from '@/editor/openPhoto'

// 用 image/*：Android 的選擇器依 MIME 過濾，列舉格式反而會漏掉系統認得但清單沒寫的
const PHOTO_ACCEPT = 'image/*'

export function OpenPhotoButton(props: Omit<ComponentProps<typeof Button>, 'onClick'>) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button {...props} onClick={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void openPhotoFile(file)
        }}
      />
    </>
  )
}
