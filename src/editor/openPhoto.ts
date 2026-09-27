import { toast } from 'sonner'
import { DecodeError, PREVIEW_MAX_EDGE, decodeImage } from '@/photo/decode'
import { useEditor } from './editorStore'

export async function openPhotoFile(file: File) {
  try {
    const preview = await decodeImage(file, PREVIEW_MAX_EDGE)
    useEditor.getState().openPhoto({ file, name: file.name, preview })
  } catch (error) {
    toast.error(error instanceof DecodeError ? error.message : '開啟照片失敗')
  }
}
