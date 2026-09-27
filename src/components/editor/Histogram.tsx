import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useView } from '@/editor/editorStore'

const WIDTH = 256
const HEIGHT = 96

// Lightroom 式的 RGB 直方圖：三個通道用「加亮」疊在一起，重疊處自然變成白、青、洋紅、黃
export function Histogram({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const histogram = useView((s) => s.histogram)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    if (!histogram) return
    ctx.globalCompositeOperation = 'lighter'
    const channels: [Uint32Array, string][] = [
      [histogram.red, 'rgba(230, 70, 70, 0.75)'],
      [histogram.green, 'rgba(70, 200, 90, 0.75)'],
      [histogram.blue, 'rgba(70, 120, 240, 0.75)'],
    ]
    for (const [bins, color] of channels) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, HEIGHT)
      for (let i = 0; i < 256; i++) {
        // 開根號讓小的柱子也看得到，和多數修圖軟體的顯示方式一樣
        const h = Math.min(1, Math.sqrt(bins[i] / histogram.max)) * HEIGHT
        ctx.lineTo((i / 255) * WIDTH, HEIGHT - h)
      }
      ctx.lineTo(WIDTH, HEIGHT)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }, [histogram])

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden
      className={cn('h-12 w-32 rounded-md bg-black/55 md:h-16 md:w-44', className)}
    />
  )
}
