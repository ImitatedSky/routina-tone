import { fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { cropOf, isValidCrop } from '@/engine/geometry'
import { useEditor, useView } from '@/editor/editorStore'
import { CropPanel } from './CropPanel'

const image = { width: 400, height: 200 }

beforeEach(() => {
  useEditor.getState().openPhoto({ file: new Blob(), name: 'a.jpg', preview: { close() {} } as ImageBitmap, ...image })
  useView.setState({ cropAspect: null })
})

const adj = () => useEditor.getState().adjustments

describe('CropPanel', () => {
  it('makes the largest square crop for 1:1', () => {
    render(<CropPanel />)
    fireEvent.click(screen.getByRole('button', { name: '1:1' }))
    const a = adj()
    expect(a.cropW * image.width).toBeCloseTo(a.cropH * image.height)
    expect(a.cropH).toBeCloseTo(1)
  })

  it('rotates 90° and keeps the crop valid', () => {
    render(<CropPanel />)
    fireEvent.click(screen.getByRole('button', { name: '向右旋轉 90°' }))
    expect(adj().rotation).toBe(1)
    expect(isValidCrop(cropOf(adj()), adj(), image)).toBe(true)
  })

  it('shrinks the crop while straightening so it stays on the photo', () => {
    render(<CropPanel />)
    const slider = screen.getByRole('slider', { name: '拉直' })
    for (let i = 0; i < 50; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(adj().straighten).toBeCloseTo(5)
    expect(adj().cropW).toBeLessThan(1)
    expect(isValidCrop(cropOf(adj()), adj(), image)).toBe(true)
  })

  it('mirrors the crop and the angle when flipping', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, cropX: 0.1, cropW: 0.5, straighten: 3 } })
    render(<CropPanel />)
    fireEvent.click(screen.getByRole('button', { name: '水平翻轉' }))
    expect(adj().flipH).toBe(1)
    expect(adj().cropX).toBeCloseTo(0.4)
    expect(adj().straighten).toBe(-3)
  })

  it('resets all geometry', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, rotation: 2, cropW: 0.5, exposure: 1 } })
    render(<CropPanel />)
    fireEvent.click(screen.getByRole('button', { name: '重設裁切' }))
    expect(adj().rotation).toBe(0)
    expect(adj().cropW).toBe(1)
    expect(adj().exposure).toBe(1)
  })
})
