import { fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { PixelPanel } from './PixelPanel'

const image = { width: 4000, height: 3000 }

beforeEach(() => {
  useEditor.getState().openPhoto({ file: new Blob(), name: 'a.jpg', preview: { close() {} } as ImageBitmap, ...image })
})

const adj = () => useEditor.getState().adjustments

describe('PixelPanel', () => {
  it('shows the options only when pixel art is on', () => {
    render(<PixelPanel />)
    expect(screen.queryByRole('slider', { name: '格數' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: '轉成像素畫' }))
    expect(adj().pixelOn).toBe(1)
    // 4000×3000 的照片、橫向 160 格 → 160 × 120
    expect(screen.getByRole('slider', { name: '格數' })).toHaveAttribute('aria-valuetext', '160 × 120')
  })

  it('switches palette and dithering, hiding the color count for fixed palettes', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, pixelOn: 1 } })
    render(<PixelPanel />)
    expect(screen.getByRole('slider', { name: '色數' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Game Boy' }))
    expect(adj().pixelPalette).toBe(2)
    expect(screen.queryByRole('slider', { name: '色數' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '擴散' }))
    expect(adj().pixelDither).toBe(2)
  })

  it('shows the export size for the scale', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, pixelOn: 1, pixelScale: 4 } })
    render(<PixelPanel />)
    expect(screen.getByRole('slider', { name: '匯出倍率' })).toHaveAttribute('aria-valuetext', '×4（640 × 480）')
  })
})
