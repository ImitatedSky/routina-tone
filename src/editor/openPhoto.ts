import { toast } from 'sonner'
import { DecodeError, decodePreview } from '@/photo/decode'
import { useEditor } from './editorStore'

export async function openPhotoFile(file: File) {
  try {
    const decoded = await decodePreview(file)
    useEditor.getState().openPhoto({ file, name: file.name, ...decoded })
  } catch (error) {
    toast.error(error instanceof DecodeError ? error.message : '開啟照片失敗')
  }
}
