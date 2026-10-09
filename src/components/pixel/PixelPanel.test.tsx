import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@/editor/editorStore'
import { usePixelArt } from '@/editor/pixelArtStore'
import { DEFAULT_PIXEL_ART } from '@/photo/pixelArt'
import { PixelPanel } from './PixelPanel'

const image = { width: 4000, height: 3000 }

beforeEach(() => {
  useEditor.getState().openPhoto({ file: new Blob(), name: 'a.jpg', preview: { close() {} } as ImageBitmap, ...image })
  usePixelArt.setState({ settings: DEFAULT_PIXEL_ART })
})

const settings = () => usePixelArt.getState().settings

describe('PixelPanel', () => {
  it('shows the grid size for the photo', () => {
    render(<PixelPanel />)
    // 4000×3000 的照片、橫向 160 格 → 160 × 120
    expect(screen.getByRole('slider', { name: '格數' })).toHaveAttribute('aria-valuetext', '160 × 120')
  })

  it('switches palette and dithering, hiding the color count for fixed palettes', () => {
    render(<PixelPanel />)
    expect(screen.getByRole('slider', { name: '色數' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Game Boy' }))
    expect(settings().palette).toBe('gameboy')
    expect(screen.queryByRole('slider', { name: '色數' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '擴散' }))
    expect(settings().dither).toBe('diffusion')
  })

  it('shows the export size for the scale', () => {
    usePixelArt.setState({ settings: { ...DEFAULT_PIXEL_ART, scale: 4 } })
    render(<PixelPanel />)
    expect(screen.getByRole('slider', { name: '匯出倍率' })).toHaveAttribute('aria-valuetext', '×4（640 × 480）')
  })

  it('keeps pixel settings out of the grading adjustments and remembers them', () => {
    render(<PixelPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'PICO-8' }))
    expect(useEditor.getState().past).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('tone-pixel-art')!).palette).toBe('pico8')
  })
})
