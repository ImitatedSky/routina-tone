import {
  BANDS,
  CURVE_CHANNELS,
  GRADE_RANGES,
  normalizeAdjustments,
  type Adjustments,
  type CurveChannel,
  type CurvePoint,
  type ScalarKey,
} from '@/engine/adjustments'
import { t } from '@/i18n/i18n'
import { normalizeGroup } from './presetFile'

// 匯入 Lightroom / Camera Raw 的 .xmp 預設集

const CRS_NS = 'http://ns.adobe.com/camera-raw-settings/1.0/'
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'

export interface XmpImport {
  name: string
  group: string
  adjustments: Adjustments
  warnings: string[]
}

export class XmpError extends Error {}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}

// crs 名稱 → 我們的參數名稱，數值直接照搬
const DIRECT_KEYS: Record<string, ScalarKey> = {
  IncrementalTemperature: 'temp',
  IncrementalTint: 'tint',
  Exposure2012: 'exposure',
  Contrast2012: 'contrast',
  Highlights2012: 'highlights',
  Shadows2012: 'shadows',
  Whites2012: 'whites',
  Blacks2012: 'blacks',
  Texture: 'texture',
  Clarity2012: 'clarity',
  Dehaze: 'dehaze',
  Vibrance: 'vibrance',
  Saturation: 'saturation',

  ParametricHighlights: 'curveHighlights',
  ParametricLights: 'curveLights',
  ParametricDarks: 'curveDarks',
  ParametricShadows: 'curveShadows',
  ParametricShadowSplit: 'curveShadowSplit',
  ParametricMidtoneSplit: 'curveMidtoneSplit',
  ParametricHighlightSplit: 'curveHighlightSplit',

  ColorGradeBlending: 'gradeBlending',
  ColorGradeBalance: 'gradeBalance',

  Sharpness: 'sharpenAmount',
  SharpenRadius: 'sharpenRadius',
  SharpenDetail: 'sharpenDetail',
  SharpenEdgeMasking: 'sharpenMasking',

  PostCropVignetteAmount: 'vignetteAmount',
  PostCropVignetteMidpoint: 'vignetteMidpoint',
  PostCropVignetteFeather: 'vignetteFeather',
  PostCropVignetteRoundness: 'vignetteRoundness',
  PostCropVignetteHighlightContrast: 'vignetteHighlights',

  GrainAmount: 'grainAmount',
  GrainSize: 'grainSize',
  GrainFrequency: 'grainRoughness',
}

for (const band of BANDS) {
  const name = capitalize(band)
  DIRECT_KEYS[`HueAdjustment${name}`] = `hue${name}` as ScalarKey
  DIRECT_KEYS[`SaturationAdjustment${name}`] = `sat${name}` as ScalarKey
  DIRECT_KEYS[`LuminanceAdjustment${name}`] = `lum${name}` as ScalarKey
}

for (const range of GRADE_RANGES) {
  const name = capitalize(range)
  for (const part of ['Hue', 'Sat', 'Lum']) {
    DIRECT_KEYS[`ColorGrade${name}${part}`] = `grade${name}${part}` as ScalarKey
  }
}

// 舊版的分割色調，只有在沒有任何 ColorGrade* 時才用
const SPLIT_TONING_KEYS: Record<string, ScalarKey> = {
  SplitToningShadowHue: 'gradeShadowHue',
  SplitToningShadowSaturation: 'gradeShadowSat',
  SplitToningHighlightHue: 'gradeHighlightHue',
  SplitToningHighlightSaturation: 'gradeHighlightSat',
  SplitToningBalance: 'gradeBalance',
}

const CURVE_KEYS: Record<string, CurveChannel> = {
  ToneCurvePV2012: 'rgb',
  ToneCurvePV2012Red: 'red',
  ToneCurvePV2012Green: 'green',
  ToneCurvePV2012Blue: 'blue',
}

const MASK_KEYS = [
  'MaskGroupBasedCorrections',
  'GradientBasedCorrections',
  'CircularGradientBasedCorrections',
  'PaintBasedCorrections',
]

// 從 XML 讀出來的 crs 設定。values 是單一值（屬性或純文字元素），
// complex 是有子元素的（名稱、曲線、描述檔、遮罩）
interface CrsSettings {
  values: Map<string, string>
  complex: Map<string, Element>
}

// 遮罩、Look 裡面也有 crs 屬性，那些不是整張照片的設定，要跳過
function isInsideCrsElement(el: Element): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.namespaceURI === CRS_NS) return true
  }
  return false
}

function readCrsSettings(doc: Document): CrsSettings {
  const values = new Map<string, string>()
  const complex = new Map<string, Element>()
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (isInsideCrsElement(el)) continue
    for (const attr of Array.from(el.attributes)) {
      if (attr.namespaceURI === CRS_NS) values.set(attr.localName, attr.value.trim())
    }
    if (el.namespaceURI === CRS_NS) {
      if (el.children.length > 0) complex.set(el.localName, el)
      else values.set(el.localName, (el.textContent ?? '').trim())
    }
  }
  return { values, complex }
}

function listItems(el: Element): Element[] {
  return Array.from(el.getElementsByTagNameNS(RDF_NS, 'li'))
}

// 名稱、群組：可能是多語系的 rdf:Alt，也可能是屬性
function readText(settings: CrsSettings, key: string): string {
  const alt = settings.complex.get(key)
  if (alt) {
    const items = listItems(alt)
    const preferred = items.find((li) => li.getAttribute('xml:lang') === 'x-default') ?? items[0]
    const text = preferred?.textContent?.trim()
    if (text) return text
  }
  return settings.values.get(key) ?? ''
}

// "x, y" 一行一點
function readCurve(el: Element): CurvePoint[] {
  const points: CurvePoint[] = []
  for (const li of listItems(el)) {
    const [x, y] = (li.textContent ?? '').split(',').map((s) => parseFloat(s))
    if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y])
  }
  return points
}

function readNumber(values: Map<string, string>, key: string): number | undefined {
  const text = values.get(key)
  if (text === undefined) return undefined
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : undefined
}

function fileBaseName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  return base.replace(/\.[^.]+$/, '').trim()
}

export function parseXmpPreset(text: string, fileName: string): XmpImport {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new XmpError(t().presets.invalidXml)
  }
  const settings = readCrsSettings(doc)
  if (settings.values.size === 0 && settings.complex.size === 0) {
    throw new XmpError(t().presets.notXmpPreset)
  }
  const { values, complex } = settings
  const warnings = new Set<string>()
  const raw: Record<string, unknown> = {}

  for (const [crsKey, key] of Object.entries(DIRECT_KEYS)) {
    const n = readNumber(values, crsKey)
    if (n !== undefined) raw[key] = n
  }

  const hasColorGrade = [...values.keys()].some((k) => k.startsWith('ColorGrade'))
  if (!hasColorGrade) {
    for (const [crsKey, key] of Object.entries(SPLIT_TONING_KEYS)) {
      const n = readNumber(values, crsKey)
      if (n !== undefined) raw[key] = n
    }
  }

  const curve: Partial<Record<CurveChannel, CurvePoint[]>> = {}
  for (const [crsKey, channel] of Object.entries(CURVE_KEYS)) {
    const el = complex.get(crsKey)
    if (el) curve[channel] = readCurve(el)
  }
  if (CURVE_CHANNELS.some((c) => curve[c])) raw.curve = curve

  // 白平衡：只有相對值（Incremental*）能套在 JPEG 上
  const hasIncrementalWb = values.has('IncrementalTemperature') || values.has('IncrementalTint')
  if (!hasIncrementalWb && (values.has('Temperature') || values.has('Tint'))) {
    warnings.add(t().presets.xmpAbsoluteWhiteBalance)
  }

  if (values.get('ConvertToGrayscale')?.toLowerCase() === 'true') {
    raw.saturation = -100
    const hasGrayMix = [...values.keys()].some((k) => k.startsWith('GrayMixer') && readNumber(values, k))
    if (hasGrayMix) warnings.add(t().presets.xmpGrayMixer)
  }

  if (complex.has('Look') || values.has('RGBTable') || [...values.keys()].some((k) => k.startsWith('Table_'))) {
    warnings.add(t().presets.xmpLook)
  }

  const profile = values.get('CameraProfile') ?? ''
  if (profile !== '' && profile !== 'Adobe Standard') {
    warnings.add(t().presets.xmpCameraProfile(profile))
  }

  const hasMasks = MASK_KEYS.some((k) => {
    const el = complex.get(k)
    return (el !== undefined && listItems(el).length > 0) || (values.get(k) ?? '') !== ''
  })
  if (hasMasks) warnings.add(t().presets.xmpMasks)

  if (values.get('HasCrop')?.toLowerCase() === 'true') warnings.add(t().presets.xmpCrop)
  if (values.get('LensProfileEnable') === '1') warnings.add(t().presets.xmpLensProfile)

  const name = readText(settings, 'Name') || fileBaseName(fileName) || t().presets.untitled
  const group = normalizeGroup(readText(settings, 'Group'))
  return { name, group, adjustments: normalizeAdjustments(raw), warnings: [...warnings] }
}
