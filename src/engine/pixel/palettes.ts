export type PaletteId = 'auto' | 'console16' | 'gameboy' | 'pico8' | 'nes'

export const PALETTE_IDS: PaletteId[] = ['auto', 'console16', 'gameboy', 'pico8', 'nes']

export type Rgb = [number, number, number] // 0..255

function fromHex(list: string): Rgb[] {
  return list
    .trim()
    .split(/\s+/)
    .map((hex) => [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ])
}

// 原版 Game Boy (DMG) 的四階綠，由暗到亮
const GAMEBOY = fromHex('0f380f 306230 8bac0f 9bbc0f')

const PICO8 = fromHex(`
  000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8
  ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa
`)

// 常見的 NES 2C02 調色盤（64 格），每列結尾重複的黑色只留一個
const NES = fromHex(`
  7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000
  bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888
  f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878
  fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc f8d8f8
`)

export const FIXED_PALETTES: { gameboy: Rgb[]; pico8: Rgb[]; nes: Rgb[] } = {
  gameboy: GAMEBOY,
  pico8: PICO8,
  nes: NES,
}
