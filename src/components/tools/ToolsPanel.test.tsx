import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor, useView } from '@/editor/editorStore'
import { ToolsPanel } from './ToolsPanel'

beforeEach(() => {
  useEditor.getState().openPhoto({ file: new Blob(), name: 'a.jpg', preview: { close() {} } as ImageBitmap, width: 400, height: 300 })
  useView.setState({ workspace: 'tools', tool: null })
})

describe('ToolsPanel', () => {
  it('opens a tool from the list and goes back', () => {
    render(<ToolsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /像素畫/ }))
    expect(useView.getState().tool).toBe('pixel')
    expect(screen.getByRole('slider', { name: '格數' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '回到工具清單' }))
    expect(useView.getState().tool).toBeNull()
  })
})
