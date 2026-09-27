// 一個全螢幕三角形 + 一個逐像素的調色 fragment shader。
// 白平衡與曝光在線性空間做；色調與飽和度在 sRGB 編碼（感知）空間做，滑桿手感才自然。

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  // ImageBitmap 上傳時第一列是照片最上面，所以 v 要反過來
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;
uniform mat3 u_whiteBalance;
uniform float u_exposure;   // EV
uniform float u_contrast;   // 以下都是 -1..1
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_vibrance;
uniform float u_saturation;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float TAU = 6.2831853;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 lin = srgbToLinear(texture(u_image, v_uv).rgb);
  lin = u_whiteBalance * lin;
  lin *= exp2(u_exposure);

  // 曝光之後可能超過 1，先留著，亮部滑桿還能把它拉回來
  vec3 p = linearToSrgb(lin);

  // 亮部 / 陰影：依亮度做遮罩，整個像素等比例縮放，色相不會跑掉
  float y = dot(p, LUMA);
  float shadowMask = 1.0 - smoothstep(0.0, 0.5, y);
  float highlightMask = smoothstep(0.5, 1.0, y);
  p *= max(0.0, 1.0 + u_shadows * 0.6 * shadowMask + u_highlights * 0.4 * highlightMask);

  // 對比：以中間灰為支點的 S 曲線，|c| <= 1 時保證單調
  vec3 pc = clamp(p, 0.0, 1.0);
  p -= u_contrast * sin(TAU * pc) / TAU;

  // 白色 / 黑色：主要動到兩端
  pc = clamp(p, 0.0, 1.0);
  p += u_whites * 0.25 * pc * pc * pc;
  vec3 inv = 1.0 - pc;
  p += u_blacks * 0.25 * inv * inv * inv;

  // 飽和度對所有顏色一樣；自然飽和度對原本越不飽和的顏色加越多。
  // 兩者相乘，飽和度 -100 時不管自然飽和度多少都是黑白。
  float luma = dot(p, LUMA);
  float maxC = max(p.r, max(p.g, p.b));
  float minC = min(p.r, min(p.g, p.b));
  float sat = maxC > 0.0 ? (maxC - minC) / maxC : 0.0;
  float amount = (1.0 + u_saturation) * max(0.0, 1.0 + u_vibrance * (1.0 - sat));
  p = mix(vec3(luma), p, amount);

  outColor = vec4(clamp(p, 0.0, 1.0), 1.0);
}
`
