// 曲線、混色器、色彩分級、色輪
const zh = {
  curve: {
    channelsLabel: '曲線頻道',
    channels: { rgb: 'RGB', red: '紅', green: '綠', blue: '藍' },
    editorLabel: '色調曲線編輯器：點一下新增控制點，拖曳調整，拖出框外或雙擊刪除',
    input: '輸入',
    output: '輸出',
    addPointHint: '點一下曲線新增控制點',
    region: '區域',
    regions: { highlights: '亮部', lights: '亮調', darks: '暗調', shadows: '陰影' },
    splits: '分界點',
    splitPoints: { shadow: '陰影分界', midtone: '中間分界', highlight: '亮部分界' },
  },
  mixer: {
    chooseColor: '選擇顏色',
    bands: {
      red: '紅色',
      orange: '橙色',
      yellow: '黃色',
      green: '綠色',
      aqua: '水綠色',
      blue: '藍色',
      purple: '紫色',
      magenta: '洋紅色',
    },
  },
  // 混色器與色彩分級共用
  properties: { hue: '色相', sat: '飽和度', lum: '明度' },
  grading: {
    ranges: { shadow: '陰影', midtone: '中間調', highlight: '亮部', global: '全局' },
    wheel: (range: string) => `${range}色輪`,
    blendBalance: '混合與平衡',
    blending: '混合',
    balance: '平衡',
  },
  wheel: {
    hue: '色相',
    sat: '飽和度',
  },
}

export const panels = {
  'zh-Hant': zh,
  en: {
    curve: {
      channelsLabel: 'Curve channel',
      channels: { rgb: 'RGB', red: 'Red', green: 'Green', blue: 'Blue' },
      editorLabel: 'Tone curve editor: click to add a point, drag to adjust, drag out or double-click to delete',
      input: 'Input',
      output: 'Output',
      addPointHint: 'Click the curve to add a point',
      region: 'Region',
      regions: { highlights: 'Highlights', lights: 'Lights', darks: 'Darks', shadows: 'Shadows' },
      splits: 'Split Points',
      splitPoints: { shadow: 'Shadow split', midtone: 'Midtone split', highlight: 'Highlight split' },
    },
    mixer: {
      chooseColor: 'Choose color',
      bands: {
        red: 'Red',
        orange: 'Orange',
        yellow: 'Yellow',
        green: 'Green',
        aqua: 'Aqua',
        blue: 'Blue',
        purple: 'Purple',
        magenta: 'Magenta',
      },
    },
    properties: { hue: 'Hue', sat: 'Saturation', lum: 'Luminance' },
    grading: {
      ranges: { shadow: 'Shadows', midtone: 'Midtones', highlight: 'Highlights', global: 'Global' },
      wheel: (range: string) => `${range} wheel`,
      blendBalance: 'Blending & Balance',
      blending: 'Blending',
      balance: 'Balance',
    },
    wheel: {
      hue: 'Hue',
      sat: 'Saturation',
    },
  } satisfies typeof zh,
}
