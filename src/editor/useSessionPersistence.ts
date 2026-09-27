import { useEffect, useState } from 'react'
import { decodePreview } from '@/photo/decode'
import { loadSession, saveSessionAdjustments, saveSessionPhoto } from '@/storage/db'
import { useEditor } from './editorStore'

// 啟動時還原上次編輯的照片與參數；之後照片或提交的參數一變就存起來。
// 回傳是否還在還原中。
export function useSessionPersistence(): boolean {
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let cancelled = false

    loadSession()
      .then(async (session) => {
        if (!session || cancelled || useEditor.getState().photo) return
        const decoded = await decodePreview(session.photo)
        if (cancelled) {
          decoded.preview.close()
          return
        }
        useEditor.getState().openPhoto({ file: session.photo, name: session.photoName, ...decoded }, session.adjustments)
      })
      .catch((error) => console.warn('restore session failed', error))
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })

    const unsubscribe = useEditor.subscribe((state, prev) => {
      if (!state.photo) return
      if (state.photo !== prev.photo) {
        saveSessionPhoto(state.photo.file, state.photo.name).catch((e) => console.warn('save photo failed', e))
      }
      if (state.photo !== prev.photo || state.committed !== prev.committed) {
        saveSessionAdjustments(state.committed).catch((e) => console.warn('save adjustments failed', e))
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return restoring
}
