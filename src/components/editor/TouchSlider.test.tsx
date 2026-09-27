import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { TouchSlider } from './TouchSlider'

// 軌道 200px 寬、範圍 -100..100：手指往右 1px = +1
function setup(onCommit = vi.fn()) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 200, height: 16, right: 200, bottom: 16, x: 0, y: 0, toJSON: () => ({}),
  })
  function Harness() {
    const [value, setValue] = useState(0)
    return (
      <TouchSlider value={value} min={-100} max={100} step={1} label="對比" valueText={String(value)}
        onChange={setValue} onCommit={onCommit} onReset={() => setValue(0)} />
    )
  }
  render(<Harness />)
  return { slider: screen.getByRole('slider'), onCommit }
}

const touch = { pointerId: 1, pointerType: 'touch', button: 0 }

afterEach(() => vi.restoreAllMocks())

describe('TouchSlider on touch', () => {
  it('ignores a vertical swipe so the panel can scroll', () => {
    const { slider, onCommit } = setup()
    fireEvent.pointerDown(slider, { ...touch, clientX: 50, clientY: 100 })
    fireEvent.pointerMove(slider, { ...touch, clientX: 53, clientY: 130 })
    fireEvent.pointerMove(slider, { ...touch, clientX: 90, clientY: 160 })
    fireEvent.pointerUp(slider, { ...touch, clientX: 90, clientY: 160 })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not jump to where the finger lands', () => {
    const { slider } = setup()
    fireEvent.pointerDown(slider, { ...touch, clientX: 180, clientY: 10 })
    fireEvent.pointerUp(slider, { ...touch, clientX: 180, clientY: 10 })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  it('adjusts relative to the start once dragged sideways, and commits once', () => {
    const { slider, onCommit } = setup()
    fireEvent.pointerDown(slider, { ...touch, clientX: 50, clientY: 10 })
    fireEvent.pointerMove(slider, { ...touch, clientX: 62, clientY: 11 }) // 鎖定成水平
    fireEvent.pointerMove(slider, { ...touch, clientX: 92, clientY: 14 })
    expect(slider).toHaveAttribute('aria-valuenow', '30')
    fireEvent.pointerUp(slider, { ...touch, clientX: 92, clientY: 14 })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})

describe('TouchSlider with mouse and keyboard', () => {
  it('jumps to the clicked position with a mouse', () => {
    const { slider } = setup()
    fireEvent.pointerDown(slider, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 150, clientY: 8 })
    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })

  it('steps with the arrow keys and resets on double-click', () => {
    const { slider } = setup()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    fireEvent.doubleClick(slider)
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })
})
