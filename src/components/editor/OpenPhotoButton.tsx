import { useRef, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { openPhotoFile } from '@/editor/openPhoto'

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

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
