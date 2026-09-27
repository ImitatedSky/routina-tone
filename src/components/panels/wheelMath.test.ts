import { hueSatToPoint, pointToHueSat } from './wheelMath'

function close(a: number, b: number) {
  expect(a).toBeCloseTo(b, 6)
}

describe('color wheel math', () => {
  it('puts red at the top and goes clockwise like conic-gradient', () => {
    const red = hueSatToPoint(0, 100)
    close(red.x, 0)
    close(red.y, -1)

    // 90 度在 3 點鐘方向
    const right = hueSatToPoint(90, 100)
    close(right.x, 1)
    close(right.y, 0)

    // 180（青色）在正下方，270 在 9 點鐘方向
    close(hueSatToPoint(180, 100).y, 1)
    close(hueSatToPoint(270, 100).x, -1)
  })

  it('maps saturation to distance from the center', () => {
    const p = hueSatToPoint(0, 50)
    close(p.y, -0.5)
    expect(pointToHueSat(0, 0).sat).toBe(0)
  })

  it('reads hue and saturation back from a point', () => {
    for (const hue of [0, 45, 120, 200, 240, 330]) {
      for (const sat of [10, 60, 100]) {
        const { x, y } = hueSatToPoint(hue, sat)
        const back = pointToHueSat(x, y)
        close(back.hue, hue)
        close(back.sat, sat)
      }
    }
  })

  it('keeps hue in 0..360 and clamps points outside the circle to the rim', () => {
    const left = pointToHueSat(-3, 0)
    close(left.hue, 270)
    expect(left.sat).toBe(100)
    const hue = pointToHueSat(-0.01, -1).hue
    expect(hue).toBeGreaterThan(359)
    expect(hue).toBeLessThan(360)
  })
})
