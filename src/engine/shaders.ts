// 所有 pass 共用一個全螢幕三角形。
// 貼圖與中間結果在記憶體裡一律是「第一列 = 照片最上面」（ImageBitmap 上傳就是這樣），
// 所以畫到 framebuffer 時 uv 直接對應；只有畫到畫面上時要上下翻，因為畫面的第一列在最下面。
export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
uniform float u_flipY;
void main() {
  float v = a_position.y * 0.5 + 0.5;
  v_uv = vec2(a_position.x * 0.5 + 0.5, u_flipY > 0.5 ? 1.0 - v : v);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// 中間結果（模糊過的亮度）一律用 sRGB 編碼存在 RGBA8 的 R 通道：
// 不需要任何浮點擴充，精度也和 8-bit 的 JPEG 原圖相當。
const COLOR_FUNCTIONS = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float srgbToLinear1(float c) { return srgbToLinear(vec3(c)).r; }
float linearToSrgb1(float c) { return linearToSrgb(vec3(c)).r; }
`

// 縮小並轉成亮度：每個輸出像素平均 factor×factor 個來源像素。
// 用雙線性取樣的「兩兩之間」位置，一次取樣就平均了 2×2。
export const LUMA_DOWN_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform int u_factor;
${COLOR_FUNCTIONS}
void main() {
  vec2 center = v_uv * u_srcSize;
  float sum = 0.0;
  float count = 0.0;
  if (u_factor == 1) {
    sum = dot(srgbToLinear(texture(u_src, v_uv).rgb), LUMA);
    count = 1.0;
  } else {
    int taps = u_factor / 2;
    for (int j = 0; j < 8; j++) {
      if (j >= taps) break;
      for (int i = 0; i < 8; i++) {
        if (i >= taps) break;
        vec2 pos = center - float(u_factor) * 0.5 + 1.0 + 2.0 * vec2(float(i), float(j));
        sum += dot(srgbToLinear(texture(u_src, pos / u_srcSize).rgb), LUMA);
        count += 1.0;
      }
    }
  }
  outColor = vec4(linearToSrgb1(sum / count), 0.0, 0.0, 1.0);
}
`

// 一個方向的高斯模糊（R 通道），水平、垂直各跑一次
export const BLUR_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform vec2 u_step;   // 一個像素的 uv 位移，只有模糊方向那一軸不為 0
uniform float u_sigma;
void main() {
  int radius = int(ceil(u_sigma * 3.0));
  float sum = 0.0;
  float weights = 0.0;
  for (int i = -24; i <= 24; i++) {
    if (i < -radius || i > radius) continue;
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * u_sigma * u_sigma));
    sum += texture(u_src, v_uv + u_step * x).r * w;
    weights += w;
  }
  outColor = vec4(sum / weights, 0.0, 0.0, 1.0);
}
`

// 主要的調色 pass。順序大致照 Lightroom：
// 去霧 → 白平衡 → 曝光 → 局部對比（紋理 / 清晰度 / 銳化）→ 亮部陰影、對比、白色黑色
// → 自然飽和度 / 飽和度 → 曲線 → 混色器 → 色彩分級 → 暗角 → 顆粒。
// 白平衡、曝光、去霧在線性空間；其餘在 sRGB 編碼（感知）空間，滑桿的手感才自然。
export const DEVELOP_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;
uniform sampler2D u_textureBase;  // 目標自己的模糊亮度（紋理用）
uniform sampler2D u_sharpenBase;  // 目標自己的模糊亮度（銳化用）
uniform sampler2D u_clarityBase;  // 整張照片的大範圍模糊亮度（清晰度、亮部陰影遮罩用）
uniform sampler2D u_haze;         // 整張照片的暗通道
uniform sampler2D u_curves;       // 1024×4：主曲線、紅、綠、藍

uniform vec4 u_region;     // 目標（來源的一塊）在整張原圖中的位置（0..1）：xy 起點、zw 大小
uniform mat3 u_geometry;   // 輸出 uv → 原圖 uv（裁切、拉直、旋轉、翻轉），見 geometry.ts
uniform vec4 u_outRegion;  // 這次畫的是整張輸出裡的哪一塊（0..1）
uniform vec2 u_outputSize; // 整張輸出（裁切後）的原圖像素尺寸
uniform vec3 u_atmosphere;
uniform mat3 u_whiteBalance;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_texture;
uniform float u_clarity;
uniform float u_dehaze;
uniform float u_vibrance;
uniform float u_saturation;
uniform float u_sharpenAmount;
uniform float u_sharpenMasking;
uniform float u_hue[8];
uniform float u_sat[8];
uniform float u_lum[8];
uniform vec4 u_gradeShadow;     // rgb 色偏、a 亮度偏移
uniform vec4 u_gradeMidtone;
uniform vec4 u_gradeHighlight;
uniform vec4 u_gradeGlobal;
uniform float u_gradePivot;
uniform float u_gradeBlend;
uniform vec4 u_vignette;   // 強度 -1..1、中點 0..1、羽化 0..1、圓度 -1..1
uniform vec3 u_grain;      // 強度 0..1、顆粒大小（原圖像素）、粗糙度 0..1

// 局部遮罩（見 masks.ts），最多 8 個
uniform vec2 u_sourceSize;     // 原圖像素尺寸，遮罩的距離要在像素上算才不會被長寬比拉扁
uniform int u_maskCount;
uniform vec4 u_maskShape[8];   // 線性：起點 xy、終點 zw；放射狀：中心 xy、半徑 zw（原圖 uv）
uniform vec4 u_maskInfo[8];    // 型別（0 線性、1 放射狀）、羽化 0..1、反轉 0/1
uniform vec4 u_maskA[8];       // 曝光（EV）、對比、亮部、陰影（-1..1）
uniform vec4 u_maskB[8];       // 飽和度、清晰度、紋理、去朦朧（-1..1）
uniform mat3 u_maskWB[8];      // 局部白平衡
uniform int u_showMask;        // 要塗紅顯示範圍的遮罩，-1 = 不顯示

${COLOR_FUNCTIONS}
const float TAU = 6.2831853;
// log 亮度的下限，避免純黑的 log 爆掉、放大暗部雜訊
const float LOG_EPS = 0.004;
// 混色器 8 個色帶在 OKLCH 色相環上的中心（度）
const float BAND_CENTERS[8] = float[8](25.0, 55.0, 105.0, 142.0, 195.0, 260.0, 295.0, 330.0);

float cbrt(float x) { return sign(x) * pow(abs(x), 1.0 / 3.0); }

vec3 linearToOklab(vec3 c) {
  float l = cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  float m = cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  float s = cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

// 相鄰色帶之間線性過渡，8 個權重加起來永遠是 1，色相之間不會有斷層
float bandWeight(float hue, int i) {
  float center = BAND_CENTERS[i];
  float left = mod(center - BAND_CENTERS[(i + 7) % 8] + 360.0, 360.0);
  float right = mod(BAND_CENTERS[(i + 1) % 8] - center + 360.0, 360.0);
  float d = mod(hue - center + 540.0, 360.0) - 180.0;
  return d < 0.0 ? max(0.0, 1.0 + d / left) : max(0.0, 1.0 - d / right);
}

float curve(float x, float row) {
  float u = (clamp(x, 0.0, 1.0) * 1023.0 + 0.5) / 1024.0;
  return texture(u_curves, vec2(u, (row + 0.5) / 4.0)).r;
}

float hash(ivec2 p) {
  uvec2 q = uvec2(p);
  uint h = q.x * 1597334677u ^ q.y * 3812015801u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  h ^= h >> 13u;
  return float(h) / 4294967295.0;
}

float valueNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  return mix(
    mix(hash(c), hash(c + ivec2(1, 0)), f.x),
    mix(hash(c + ivec2(0, 1)), hash(c + ivec2(1, 1)), f.x),
    f.y);
}

// 線性：起點以前完全套用、終點以後不套用，中間平滑過渡。放射狀：橢圓內套用，羽化決定邊緣多軟
float maskWeight(int i, vec2 px) {
  vec4 shape = u_maskShape[i];
  vec4 info = u_maskInfo[i];
  float w;
  if (info.x < 0.5) {
    vec2 a = shape.xy * u_sourceSize;
    vec2 d = shape.zw * u_sourceSize - a;
    float along = dot(px - a, d) / max(dot(d, d), 1e-6);
    w = 1.0 - smoothstep(0.0, 1.0, along);
  } else {
    vec2 r = max(shape.zw * u_sourceSize, vec2(1.0));
    float e = length((px - shape.xy * u_sourceSize) / r);
    w = 1.0 - smoothstep(1.0 - info.y, 1.0001, e);
  }
  return info.z > 0.5 ? 1.0 - w : w;
}

void main() {
  vec2 outUv = u_outRegion.xy + v_uv * u_outRegion.zw;
  vec2 imageUv = (u_geometry * vec3(outUv, 1.0)).xy;
  // 裁切模式顯示整個畫框，轉過的照片以外的角落畫成暗灰
  bool outside = any(lessThan(imageUv, vec2(0.0))) || any(greaterThan(imageUv, vec2(1.0)));
  vec2 tileUv = (imageUv - u_region.xy) / u_region.zw;
  vec3 lin = srgbToLinear(texture(u_image, tileUv).rgb);

  // 整體的數值加上各遮罩的局部調整（依遮罩權重）
  float exposure = u_exposure;
  float contrast = u_contrast;
  float highlights = u_highlights;
  float shadows = u_shadows;
  float saturation = u_saturation;
  float clarity = u_clarity;
  float textureAmount = u_texture;
  float dehaze = u_dehaze;
  float maskWeights[8];
  vec2 px = imageUv * u_sourceSize;
  for (int i = 0; i < 8; i++) {
    if (i >= u_maskCount) break;
    float w = maskWeight(i, px);
    maskWeights[i] = w;
    exposure += w * u_maskA[i].x;
    contrast += w * u_maskA[i].y;
    highlights += w * u_maskA[i].z;
    shadows += w * u_maskA[i].w;
    saturation += w * u_maskB[i].x;
    clarity += w * u_maskB[i].y;
    textureAmount += w * u_maskB[i].z;
    dehaze += w * u_maskB[i].w;
  }
  contrast = clamp(contrast, -1.0, 1.0);
  dehaze = clamp(dehaze, -1.0, 1.0);

  // 局部對比用的 log 亮度都取自原圖，和曝光、白平衡無關，所以只要算一次
  float sourceLog = log2(dot(lin, LUMA) + LOG_EPS);
  float textureLog = log2(srgbToLinear1(texture(u_textureBase, tileUv).r) + LOG_EPS);
  float sharpenLog = log2(srgbToLinear1(texture(u_sharpenBase, tileUv).r) + LOG_EPS);
  float baseY = srgbToLinear1(texture(u_clarityBase, imageUv).r);
  float clarityLog = log2(baseY + LOG_EPS);

  // 去霧：J = (I - A) / t + A，t 是依暗通道估出的透光率。往左是加霧
  if (dehaze > 0.0) {
    float dark = texture(u_haze, imageUv).r;
    float t = max(1.0 - dehaze * 0.95 * dark, 0.1);
    lin = max((lin - u_atmosphere) / t + u_atmosphere, 0.0);
  } else if (dehaze < 0.0) {
    lin = mix(lin, u_atmosphere, -dehaze * 0.5);
  }

  lin = u_whiteBalance * lin;
  for (int i = 0; i < 8; i++) {
    if (i >= u_maskCount) break;
    lin = mix(lin, u_maskWB[i] * lin, maskWeights[i]);
  }
  lin *= exp2(exposure);

  // 紋理 = 細節（原圖 - 小模糊）；清晰度 = 中頻（小模糊 - 大模糊），只作用在中間調；
  // 銳化 = 最細的細節，遮罩越高越只留在明顯的邊緣上
  float py = linearToSrgb1(dot(lin, LUMA));
  float midtones = clamp(4.0 * py * (1.0 - py), 0.0, 1.0);
  float edges = mix(1.0, smoothstep(0.05, 0.35, abs(sourceLog - textureLog)), u_sharpenMasking);
  float detail = textureAmount * 0.7 * (sourceLog - textureLog)
    + clarity * 0.6 * (textureLog - clarityLog) * midtones
    + u_sharpenAmount * 1.2 * (sourceLog - sharpenLog) * edges;
  lin *= exp2(clamp(detail, -3.0, 3.0));

  // 曝光之後可能超過 1，先留著，亮部滑桿還能把它拉回來
  vec3 p = linearToSrgb(lin);

  // 亮部 / 陰影：遮罩一半用像素自己、一半用大範圍的亮度，暗處裡的亮點不會被當成亮部
  float maskY = mix(dot(p, LUMA), linearToSrgb1(baseY * exp2(exposure)), 0.5);
  float shadowMask = 1.0 - smoothstep(0.0, 0.5, maskY);
  float highlightMask = smoothstep(0.5, 1.0, maskY);
  p *= max(0.0, 1.0 + shadows * 0.6 * shadowMask + highlights * 0.4 * highlightMask);

  // 對比：以中間灰為支點的 S 曲線，|c| <= 1 時保證單調
  vec3 pc = clamp(p, 0.0, 1.0);
  p -= contrast * sin(TAU * pc) / TAU;

  // 白色 / 黑色：主要動到兩端
  pc = clamp(p, 0.0, 1.0);
  p += u_whites * 0.25 * pc * pc * pc;
  vec3 inv = 1.0 - pc;
  p += u_blacks * 0.25 * inv * inv * inv;

  // 飽和度對所有顏色一樣；自然飽和度對原本越不飽和的顏色加越多。相乘，所以飽和度 -100 一定是黑白
  float luma = dot(p, LUMA);
  float maxC = max(p.r, max(p.g, p.b));
  float minC = min(p.r, min(p.g, p.b));
  float sat = maxC > 0.0 ? (maxC - minC) / maxC : 0.0;
  p = mix(vec3(luma), p, max(0.0, 1.0 + saturation) * max(0.0, 1.0 + u_vibrance * (1.0 - sat)));

  // 曲線：先主曲線（參數式 + RGB 點曲線，已在 TS 端合成），再各通道
  p = vec3(curve(p.r, 0.0), curve(p.g, 0.0), curve(p.b, 0.0));
  p = vec3(curve(p.r, 1.0), curve(p.g, 2.0), curve(p.b, 3.0));

  // 混色器：在 OKLCH 裡改色相 / 彩度 / 明度，改色相時亮度不會跟著跳
  vec3 lab = linearToOklab(srgbToLinear(p));
  float chroma = length(lab.yz);
  float hue = mod(degrees(atan(lab.z, lab.y)) + 360.0, 360.0);
  float dh = 0.0;
  float ds = 0.0;
  float dl = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = bandWeight(hue, i);
    dh += w * u_hue[i];
    ds += w * u_sat[i];
    dl += w * u_lum[i];
  }
  // 灰色沒有色相，不該被任何色帶影響
  float colorful = smoothstep(0.0, 0.06, chroma);
  float newHue = radians(hue + dh * 30.0);
  float newChroma = chroma * max(0.0, 1.0 + ds * colorful);
  lab = vec3(lab.x * (1.0 + dl * 0.35 * colorful), cos(newHue) * newChroma, sin(newHue) * newChroma);
  p = linearToSrgb(oklabToLinear(lab));

  // 色彩分級：陰影 / 中間調 / 亮部三區的遮罩，分界由平衡決定，重疊程度由混合決定
  float gy = clamp(dot(p, LUMA), 0.0, 1.0);
  float shape = mix(2.5, 0.6, u_gradeBlend);
  float inShadow = pow(clamp((u_gradePivot - gy) / u_gradePivot, 0.0, 1.0), shape);
  float inHighlight = pow(clamp((gy - u_gradePivot) / (1.0 - u_gradePivot), 0.0, 1.0), shape);
  float inMidtone = clamp(1.0 - inShadow - inHighlight, 0.0, 1.0);
  // 純黑、純白保持不染色
  inShadow *= smoothstep(0.0, 0.12, gy);
  inHighlight *= 1.0 - smoothstep(0.9, 1.0, gy);
  vec4 grade = inShadow * u_gradeShadow + inMidtone * u_gradeMidtone + inHighlight * u_gradeHighlight + u_gradeGlobal;
  p += grade.rgb + grade.a;

  // 暗角：在整張輸出（裁切後）的座標上算，和 Lightroom 的裁切後暗角一樣；分塊匯出時才接得起來
  if (u_vignette.x != 0.0) {
    vec2 c = (outUv - 0.5) * 2.0;
    float aspect = u_outputSize.x / u_outputSize.y;
    vec2 circle = aspect > 1.0 ? vec2(c.x, c.y / aspect) : vec2(c.x * aspect, c.y);
    vec2 q = abs(mix(c, circle, max(u_vignette.w, 0.0)));
    float n = u_vignette.w < 0.0 ? mix(2.0, 6.0, -u_vignette.w) : 2.0;
    float d = pow(pow(q.x, n) + pow(q.y, n), 1.0 / n);
    float start = mix(0.25, 1.35, u_vignette.y);
    float width = mix(0.05, 1.2, u_vignette.z);
    float v = smoothstep(start - width * 0.5, start + width * 0.5, d);
    p = u_vignette.x < 0.0 ? p * (1.0 + u_vignette.x * v) : mix(p, vec3(1.0), u_vignette.x * v);
  }

  // 顆粒：以輸出的原圖像素為單位的雜訊，預覽與匯出一致；中間調最明顯
  if (u_grain.x > 0.0) {
    vec2 cell = outUv * u_outputSize / u_grain.y;
    float noise = mix(valueNoise(cell), valueNoise(cell * 2.7 + 13.0), u_grain.z * 0.6);
    float y = clamp(dot(p, LUMA), 0.0, 1.0);
    p += (noise - 0.5) * u_grain.x * 0.28 * (0.35 + 2.6 * y * (1.0 - y));
  }

  if (u_showMask >= 0 && u_showMask < u_maskCount) {
    p = mix(p, vec3(1.0, 0.15, 0.15), maskWeights[u_showMask] * 0.55);
  }
  if (outside) p = vec3(0.1);
  outColor = vec4(clamp(p, 0.0, 1.0), 1.0);
}
`
