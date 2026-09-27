import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@/editor/editorStore'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { GradingPanel } from './GradingPanel'

beforeEach(() => useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS }))

describe('GradingPanel', () => {
  it('shows the wheel and luminance of the selected range', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, gradeHighlightHue: 40, gradeHighlightSat: 25 } })
    render(<GradingPanel />)
    expect(screen.getByRole('group', { name: '陰影色輪' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '亮部' }))
    expect(screen.getByRole('group', { name: '亮部色輪' })).toBeInTheDocument()
    expect(screen.getByText('色相 40°')).toBeInTheDocument()
    expect(screen.getByLabelText('明度')).toHaveAttribute('id', 'adj-gradeHighlightLum')
  })
})
