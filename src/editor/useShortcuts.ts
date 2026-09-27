import { useEffect } from 'react'
import { useEditor } from './editorStore'

function isTextField(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.type === 'text'
}

// Ctrl/Cmd+Z 復原，Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做
export function useShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || isTextField(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditor.getState().undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useEditor.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
