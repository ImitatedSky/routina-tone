import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useLanguage } from '@/i18n/i18n'
import { parseXmpPreset, XmpError } from './xmp'

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const CRS = 'http://ns.adobe.com/camera-raw-settings/1.0/'

function wrap(description: string): string {
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000">
 <rdf:RDF xmlns:rdf="${RDF}">
  ${description}
 </rdf:RDF>
</x:xmpmeta>`
}

// Lightroom Classic 13 匯出的樣子：設定都是屬性
const ATTRIBUTE_PRESET = wrap(`<rdf:Description rdf:about=""
    xmlns:crs="${CRS}"
   crs:PresetType="Normal"
   crs:Cluster=""
   crs:UUID="6A1B2C3D4E5F"
   crs:SupportsAmount2="True"
   crs:SupportsColor="True"
   crs:Version="16.0"
   crs:ProcessVersion="15.4"
   crs:WhiteBalance="As Shot"
   crs:IncrementalTemperature="+12"
   crs:IncrementalTint="-4"
   crs:Exposure2012="+0.35"
   crs:Contrast2012="-15"
   crs:Highlights2012="-40"
   crs:Shadows2012="+25"
   crs:Whites2012="+10"
   crs:Blacks2012="-20"
   crs:Texture="+5"
   crs:Clarity2012="+8"
   crs:Dehaze="+3"
   crs:Vibrance="+10"
   crs:Saturation="-5"
   crs:ParametricShadows="+10"
   crs:ParametricDarks="0"
   crs:ParametricLights="-5"
   crs:ParametricHighlights="-10"
   crs:ParametricShadowSplit="25"
   crs:ParametricMidtoneSplit="50"
   crs:ParametricHighlightSplit="75"
   crs:HueAdjustmentOrange="-6"
   crs:SaturationAdjustmentBlue="-30"
   crs:LuminanceAdjustmentGreen="+15"
   crs:ColorGradeShadowHue="210"
   crs:ColorGradeShadowSat="15"
   crs:ColorGradeShadowLum="0"
   crs:ColorGradeMidtoneHue="40"
   crs:ColorGradeMidtoneSat="8"
   crs:ColorGradeMidtoneLum="-2"
   crs:ColorGradeHighlightHue="45"
   crs:ColorGradeHighlightSat="20"
   crs:ColorGradeHighlightLum="0"
   crs:ColorGradeGlobalHue="0"
   crs:ColorGradeGlobalSat="0"
   crs:ColorGradeGlobalLum="0"
   crs:ColorGradeBlending="60"
   crs:ColorGradeBalance="-10"
   crs:SplitToningShadowHue="210"
   crs:SplitToningShadowSaturation="15"
   crs:SplitToningHighlightHue="45"
   crs:SplitToningHighlightSaturation="20"
   crs:SplitToningBalance="-10"
   crs:Sharpness="40"
   crs:SharpenRadius="+1.0"
   crs:SharpenDetail="40"
   crs:SharpenEdgeMasking="20"
   crs:PostCropVignetteAmount="-18"
   crs:PostCropVignetteMidpoint="40"
   crs:PostCropVignetteFeather="70"
   crs:PostCropVignetteRoundness="0"
   crs:PostCropVignetteHighlightContrast="30"
   crs:GrainAmount="22"
   crs:GrainSize="30"
   crs:GrainFrequency="60"
   crs:CameraProfile="Adobe Standard"
   crs:HasSettings="True">
   <crs:Name>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">Warm Film</rdf:li>
    </rdf:Alt>
   </crs:Name>
   <crs:Group>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">Film</rdf:li>
    </rdf:Alt>
   </crs:Group>
   <crs:ToneCurvePV2012>
    <rdf:Seq>
     <rdf:li>0, 12</rdf:li>
     <rdf:li>64, 60</rdf:li>
     <rdf:li>192, 200</rdf:li>
     <rdf:li>255, 245</rdf:li>
    </rdf:Seq>
   </crs:ToneCurvePV2012>
   <crs:ToneCurvePV2012Red>
    <rdf:Seq>
     <rdf:li>0, 0</rdf:li>
     <rdf:li>128, 136</rdf:li>
     <rdf:li>255, 255</rdf:li>
    </rdf:Seq>
   </crs:ToneCurvePV2012Red>
   <crs:ToneCurvePV2012Green>
    <rdf:Seq>
     <rdf:li>0, 0</rdf:li>
     <rdf:li>255, 255</rdf:li>
    </rdf:Seq>
   </crs:ToneCurvePV2012Green>
   <crs:ToneCurvePV2012Blue>
    <rdf:Seq>
     <rdf:li>0, 10</rdf:li>
     <rdf:li>255, 240</rdf:li>
    </rdf:Seq>
   </crs:ToneCurvePV2012Blue>
  </rdf:Description>`)

describe('parseXmpPreset', () => {
  it('reads an attribute-style Lightroom Classic preset', () => {
    const result = parseXmpPreset(ATTRIBUTE_PRESET, 'Warm Film.xmp')
    expect(result.name).toBe('Warm Film')
    expect(result.group).toBe('Film')
    expect(result.warnings).toEqual([])
    const adj = result.adjustments
    expect(adj).toMatchObject({
      temp: 12,
      tint: -4,
      exposure: 0.35,
      contrast: -15,
      highlights: -40,
      shadows: 25,
      whites: 10,
      blacks: -20,
      texture: 5,
      clarity: 8,
      dehaze: 3,
      vibrance: 10,
      saturation: -5,
      curveShadows: 10,
      curveLights: -5,
      curveHighlights: -10,
      hueOrange: -6,
      satBlue: -30,
      lumGreen: 15,
      gradeShadowHue: 210,
      gradeShadowSat: 15,
      gradeMidtoneHue: 40,
      gradeMidtoneSat: 8,
      gradeMidtoneLum: -2,
      gradeHighlightHue: 45,
      gradeHighlightSat: 20,
      gradeBlending: 60,
      gradeBalance: -10,
      sharpenAmount: 40,
      sharpenRadius: 1,
      sharpenDetail: 40,
      sharpenMasking: 20,
      vignetteAmount: -18,
      vignetteMidpoint: 40,
      vignetteFeather: 70,
      vignetteHighlights: 30,
      grainAmount: 22,
      grainSize: 30,
      grainRoughness: 60,
    })
    expect(adj.curve).toEqual({
      rgb: [
        [0, 12],
        [64, 60],
        [192, 200],
        [255, 245],
      ],
      red: [
        [0, 0],
        [128, 136],
        [255, 255],
      ],
      green: [
        [0, 0],
        [255, 255],
      ],
      blue: [
        [0, 10],
        [255, 240],
      ],
    })
  })

  it('reads child-element style settings and falls back to the file name', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}">
      <crs:Exposure2012>+0.50</crs:Exposure2012>
      <crs:Contrast2012>+20</crs:Contrast2012>
      <crs:HueAdjustmentRed>-10</crs:HueAdjustmentRed>
      <crs:ToneCurvePV2012>
        <rdf:Seq>
          <rdf:li>0, 0</rdf:li>
          <rdf:li>128, 140</rdf:li>
          <rdf:li>255, 255</rdf:li>
        </rdf:Seq>
      </crs:ToneCurvePV2012>
    </rdf:Description>`)
    const result = parseXmpPreset(text, 'Moody Blue.xmp')
    expect(result.name).toBe('Moody Blue')
    expect(result.group).toBe('')
    expect(result.adjustments).toEqual({
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0.5,
      contrast: 20,
      hueRed: -10,
      curve: {
        ...DEFAULT_ADJUSTMENTS.curve,
        rgb: [
          [0, 0],
          [128, 140],
          [255, 255],
        ],
      },
    })
  })

  it('reads the group from an attribute', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:Name="Soft" crs:Group="  My Looks  " crs:Contrast2012="+10"/>`)
    expect(parseXmpPreset(text, 'x.xmp')).toMatchObject({ name: 'Soft', group: 'My Looks' })
  })

  it('keeps the Lightroom default of 25 for sharpening detail and clamps the vignette highlights', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:SharpenDetail="25" crs:PostCropVignetteHighlightContrast="150"/>`)
    expect(parseXmpPreset(text, 'x.xmp').adjustments).toEqual({ ...DEFAULT_ADJUSTMENTS, vignetteHighlights: 100 })
  })

  it('uses legacy split toning when there is no color grading', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:SplitToningShadowHue="200"
      crs:SplitToningShadowSaturation="25"
      crs:SplitToningHighlightHue="50"
      crs:SplitToningHighlightSaturation="30"
      crs:SplitToningBalance="+20"/>`)
    const adj = parseXmpPreset(text, 'old.xmp').adjustments
    expect(adj).toMatchObject({
      gradeShadowHue: 200,
      gradeShadowSat: 25,
      gradeHighlightHue: 50,
      gradeHighlightSat: 30,
      gradeBalance: 20,
    })
  })

  it('clamps out-of-range values and keeps defaults for missing keys', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:Exposure2012="+7.00"
      crs:Contrast2012="-150"
      crs:Sharpness="200"
      crs:SharpenRadius="0.1"
      crs:ParametricShadowSplit="5"
      crs:Clarity2012="abc"/>`)
    const adj = parseXmpPreset(text, 'x.xmp').adjustments
    expect(adj).toEqual({
      ...DEFAULT_ADJUSTMENTS,
      exposure: 5,
      contrast: -100,
      sharpenAmount: 150,
      sharpenRadius: 0.5,
      curveShadowSplit: 10,
    })
  })

  it('warns about things it cannot apply', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:WhiteBalance="Custom"
      crs:Temperature="5600"
      crs:Tint="+8"
      crs:Exposure2012="+0.20"
      crs:CameraProfile="Camera Standard"
      crs:HasCrop="True"
      crs:LensProfileEnable="1"
      crs:ConvertToGrayscale="True"
      crs:GrayMixerRed="-20"
      crs:GrayMixerBlue="0">
      <crs:Look>
        <rdf:Description crs:Name="Adobe Monochrome" crs:Amount="1" crs:Exposure2012="+3.00">
          <crs:Group><rdf:Alt><rdf:li xml:lang="x-default">Profiles</rdf:li></rdf:Alt></crs:Group>
        </rdf:Description>
      </crs:Look>
      <crs:MaskGroupBasedCorrections>
        <rdf:Seq>
          <rdf:li>
            <rdf:Description crs:What="Correction" crs:LocalExposure2012="+0.50" crs:Contrast2012="+80"/>
          </rdf:li>
        </rdf:Seq>
      </crs:MaskGroupBasedCorrections>
      <crs:GradientBasedCorrections>
        <rdf:Seq>
          <rdf:li><rdf:Description crs:What="Correction"/></rdf:li>
        </rdf:Seq>
      </crs:GradientBasedCorrections>
    </rdf:Description>`)
    const result = parseXmpPreset(text, 'bw.xmp')
    expect(result.warnings).toHaveLength(7)
    expect(result.warnings).toContain('Lightroom 的描述檔（Look）無法套用')
    expect(result.warnings).toContain('遮罩與局部調整尚未支援')
    expect(result.warnings.some((w) => w.includes('Camera Standard'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('白平衡'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('黑白混色'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('裁切'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('鏡頭'))).toBe(true)

    // Look 與遮罩裡的數值不能蓋掉整張照片的設定
    expect(result.adjustments).toEqual({ ...DEFAULT_ADJUSTMENTS, exposure: 0.2, saturation: -100 })
    expect(result.group).toBe('')
  })

  it('does not warn about empty masks or As Shot white balance', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:WhiteBalance="As Shot" crs:Contrast2012="+10" crs:ConvertToGrayscale="False">
      <crs:MaskGroupBasedCorrections><rdf:Seq/></crs:MaskGroupBasedCorrections>
    </rdf:Description>`)
    const result = parseXmpPreset(text, 'x.xmp')
    expect(result.warnings).toEqual([])
    expect(result.adjustments.saturation).toBe(0)
  })

  it('rejects invalid XML', () => {
    expect(() => parseXmpPreset('<x:xmpmeta><unclosed>', 'a.xmp')).toThrow(XmpError)
    expect(() => parseXmpPreset('not xml at all', 'a.xmp')).toThrow(XmpError)
  })

  it('rejects XML that has no Camera Raw settings', () => {
    const text = wrap(`<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Photo</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>`)
    expect(() => parseXmpPreset(text, 'a.xmp')).toThrow('這不是 Lightroom 的 .xmp 預設集')
  })

  it('writes warnings in English when the UI is English', () => {
    useLanguage.getState().setPref('en')
    const text = wrap(`<rdf:Description rdf:about="" xmlns:crs="${CRS}"
      crs:CameraProfile="Camera Standard" crs:HasCrop="True"/>`)
    expect(parseXmpPreset(text, 'x.xmp').warnings).toEqual([
      'Camera profile "Camera Standard" can\'t be applied; using standard color',
      'Crop settings were ignored',
    ])
  })
})
