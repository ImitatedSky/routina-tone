// 色輪的角度換算。色相沿用 HSL 色輪：0 紅、120 綠、240 藍。
// CSS conic-gradient 從 12 點鐘方向開始順時針，所以色相 0 在正上方、順時針遞增。
// 座標以圓心為原點、半徑為 1，y 朝下（和螢幕座標一樣）。

export function hueSatToPoint(hue: number, sat: number): { x: number; y: number } {
  const angle = (hue * Math.PI) / 180
  const r = sat / 100
  return { x: Math.sin(angle) * r, y: -Math.cos(angle) * r }
}

// 超出圓外的點會貼在邊緣（飽和度 100）
export function pointToHueSat(x: number, y: number): { hue: number; sat: number } {
  const degrees = (Math.atan2(x, -y) * 180) / Math.PI
  const hue = (degrees + 360) % 360
  const sat = Math.min(1, Math.hypot(x, y)) * 100
  return { hue, sat }
}

// 這個色相／飽和度代表的顏色，飽和度 0 是中性灰
export function tintColor(hue: number, sat: number): string {
  return `hsl(${hue} ${sat}% 50%)`
}

const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} 100% 50%)`).join(', ')

export const WHEEL_BACKGROUND = [
  // 中心灰色往外漸淡，讓越靠近中心越不飽和
  `radial-gradient(circle closest-side, ${tintColor(0, 0)}, transparent)`,
  `conic-gradient(${HUE_STOPS})`,
].join(', ')
