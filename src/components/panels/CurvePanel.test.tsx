import { fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { CurvePanel } from './CurvePanel'

// jsdom 沒有排版，給編輯器一個 255px 見方的位置，螢幕座標剛好等於曲線座標（y 反過來）
function layoutEditor() {
  const svg = screen.getByRole('img')
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 255, height: 255 }) as DOMRect
  svg.setPointerCapture = () => {}
  return svg
}

function pointer(type: 'pointerDown' | 'pointerMove' | 'pointerUp', svg: Element, x: number, y: number) {
  fireEvent[type](svg, { clientX: x, clientY: 255 - y, pointerId: 1, button: 0 })
}

beforeEach(() => {
  useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS, past: [], future: [] })
})

describe('CurvePanel', () => {
  it('renders the channels and the region sliders', () => {
    render(<CurvePanel />)
    expect(screen.getByRole('button', { name: /RGB/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('陰影')).toBeInTheDocument()
    expect(screen.getByLabelText('亮部分界')).toBeInTheDocument()
  })

  it('switches channel', () => {
    render(<CurvePanel />)
    fireEvent.click(screen.getByRole('button', { name: /紅/ }))
    expect(screen.getByRole('button', { name: /紅/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /RGB/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds a point and drags it as one undo step', () => {
    render(<CurvePanel />)
    const svg = layoutEditor()
    pointer('pointerDown', svg, 128, 128)
    pointer('pointerMove', svg, 128, 170)
    pointer('pointerUp', svg, 128, 170)

    const { adjustments, past } = useEditor.getState()
    expect(adjustments.curve.rgb).toEqual([
      [0, 0],
      [128, 170],
      [255, 255],
    ])
    expect(past).toHaveLength(1)
    expect(screen.getByText('170')).toBeInTheDocument()
  })

  it('removes a middle point dragged out of the box', () => {
    render(<CurvePanel />)
    const svg = layoutEditor()
    pointer('pointerDown', svg, 100, 100)
    pointer('pointerMove', svg, 100, -40)
    pointer('pointerUp', svg, 100, -40)
    expect(useEditor.getState().adjustments.curve.rgb).toHaveLength(2)
  })

  it('deletes the selected point and resets the channel', () => {
    render(<CurvePanel />)
    const svg = layoutEditor()
    pointer('pointerDown', svg, 60, 90)
    pointer('pointerUp', svg, 60, 90)
    pointer('pointerDown', svg, 190, 200)
    pointer('pointerUp', svg, 190, 200)
    expect(useEditor.getState().adjustments.curve.rgb).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(useEditor.getState().adjustments.curve.rgb).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '重設' }))
    expect(useEditor.getState().adjustments.curve.rgb).toEqual(DEFAULT_ADJUSTMENTS.curve.rgb)
  })
})
