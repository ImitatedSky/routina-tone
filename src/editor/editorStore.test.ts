import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from './editorStore'

const photo = () => ({ file: new Blob(), name: 'a.jpg', preview: { close() {} } as ImageBitmap, width: 1, height: 1 })

beforeEach(() => useEditor.getState().openPhoto(photo()))

describe('editor history', () => {
  it('counts a whole drag as one undo step', () => {
    const e = useEditor.getState()
    e.setAdjustment('exposure', 0.5)
    e.setAdjustment('exposure', 1)
    e.commit()
    useEditor.getState().undo()
    expect(useEditor.getState().adjustments.exposure).toBe(0)
  })

  it('redoes what was undone and clears redo on a new edit', () => {
    const e = useEditor.getState()
    e.setAdjustment('temp', 20)
    e.commit()
    e.undo()
    e.redo()
    expect(useEditor.getState().adjustments.temp).toBe(20)

    e.undo()
    e.setAdjustment('tint', 5)
    e.commit()
    expect(useEditor.getState().future).toEqual([])
  })

  it('commits a pending drag before undoing', () => {
    const e = useEditor.getState()
    e.setAdjustment('contrast', 10)
    e.commit()
    e.setAdjustment('contrast', 40)
    e.undo()
    expect(useEditor.getState().adjustments.contrast).toBe(10)
  })

  it('does not add a step when nothing changed', () => {
    const e = useEditor.getState()
    e.commit()
    e.apply(DEFAULT_ADJUSTMENTS)
    expect(useEditor.getState().past).toEqual([])
  })

  it('clamps values to the slider range', () => {
    useEditor.getState().setAdjustment('exposure', 12)
    expect(useEditor.getState().adjustments.exposure).toBe(5)
  })
})
