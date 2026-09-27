# Routina Tone — 規劃

照片調色 App。React 網頁版先做，之後包成 Android WebView App 加入 Routina 家族（沿用 wordcards / Routina Words 的做法）。

| 項目 | 值 |
|---|---|
| 顯示名稱 | Routina Tone |
| applicationId | `com.routina.tone` |
| repo | `ImitatedSky/routina-tone`（public，分支 `main`，tag `v*`） |
| 網頁 | `imitatedsky.github.io/routina-tone/`（Vite `base: '/routina-tone/'`） |
| 家族 id | `tone`，APK 檔名 `routina-tone-v*.apk` |

## 技術選擇

- **前端**：和 wordcards 同一套 — React 19 + TS + Vite、Tailwind 4 + shadcn（base-ui）、`idb`、next-themes、sonner、lucide、vitest。
- **狀態**：zustand（編輯參數 + undo/redo 歷史）。
- **渲染**：WebGL2 + twgl.js（薄 helper），自己寫 GLSL。
  - 不用 WebGPU：Android WebView 支援還不穩。不用 Canvas2D：逐像素太慢。
  - 沒有現成、有在維護的「網頁版 Lightroom」函式庫可以直接用；glfx.js 已停更、PixiJS filters 是遊戲取向的 8-bit。
  - 中間 framebuffer 用 RGBA16F（`EXT_color_buffer_half_float`），不支援時退回 RGBA8。
- **原則**：矩陣、LUT 這類「由參數算出來的東西」在 TS 端算好，當 uniform / texture 傳給 shader；shader 只負責逐像素套用。這樣色彩數學可以用 vitest 測。

## 處理管線

```
解碼 (createImageBitmap, imageOrientation: from-image)
  → 預覽貼圖（長邊 ~2048）          ← 原圖 Blob 保留，匯出時用
  → sRGB → 線性
  → 白平衡 Temp/Tint（Bradford 色適應 3x3，TS 端算）
  → 曝光 rgb *= 2^EV
  → 對比 / 亮部 / 陰影 / 白色 / 黑色（亮度遮罩 + 端點）
  → 轉回感知空間
  → 曲線（RGB/R/G/B，Fritsch–Carlson 單調三次，烘成 1024×4 LUT）
  → HSL 8 色（OKLCH，平滑色相權重）
  → 分級（陰影/中間調/亮部 色輪，含 Blending/Balance）
  → 自然飽和度 / 飽和度
  → 畫面
```

後期效果（清晰度、紋理、去霧、銳化）要多 pass 模糊，放在管線裡另外的 pass；暗角、顆粒是逐像素，直接加在最後。

匯出：同一條管線用原圖尺寸再跑一次。超過 `MAX_TEXTURE_SIZE` 或記憶體不夠時分塊渲染（重疊寬度 ≥ 最大模糊半徑）。`toBlob('image/jpeg', quality)` 輸出，預設 sRGB。

## 參數格式（保存 / 匯出 / 匯入）

- **自家格式**：JSON，一個預設集一個檔（`.tone.json`），不遺失任何參數。
  ```json
  { "format": "routina-tone-preset", "version": 1, "name": "暖色底片",
    "adjustments": { "temp": 12, "tint": -3, "exposure": 0.3, "curve": { "rgb": [[0,0],[64,58],[255,255]] }, "hsl": { "orange": { "h": -5, "s": 10, "l": 5 } } } }
  ```
  - `adjustments` 只存和預設值不同的欄位，讀進來時補上預設值 → 之後加新參數，舊檔也能用。
  - `version` 用來做格式遷移。
- **匯入 Lightroom `.xmp`**：用 DOMParser 讀 `crs:` 屬性，對應表寫在一個檔案裡（`IncrementalTemperature`→temp、`Exposure2012`→exposure、`HueAdjustmentRed`…、`ToneCurvePV2012*`、`ColorGrade*`）。
  - 參數名稱可以一對一對應，但**畫出來只會接近、不會完全一樣**（Adobe 的算法沒公開）。
  - 讀不了的內容（`crs:Look` 內嵌 profile、遮罩、相機 profile）略過，並提示使用者哪些項目被略過。
  - 只吃 `.xmp`；舊版 `.lrtemplate`（Lua 格式）不支援。
- 預設集存在 IndexedDB；另外自動保存「目前這張照片 + 參數」，重新整理不會不見。

## 介面

- 中間是照片；桌機右側是參數面板，手機改成底部分頁：**光線 / 色彩 / 曲線 / 混色器 / 分級 / 效果 / 預設集**。
- 按住照片 = 看原圖（前後對比）；雙擊滑桿 = 歸零；undo / redo；直方圖。
- 每個分頁都有「重設這一區」。

## 版本規劃（每版都是能用的完整產品）

> 進度：v0.1–v0.5 已完成並發佈為 v0.5.0（Android 殼原定 v0.3，提前進 v0.1.0）。HEIC 改成網頁與 App 共用同一條路（WASM 解碼器，需要時才載入），不另做 Android 原生解碼。

| 版本 | 內容 |
|---|---|
| **v0.1** | 開照片（JPEG/PNG/WebP）→ 基本面板：Temp、Tint、曝光、對比、亮部、陰影、白色、黑色、自然飽和度、飽和度 → 前後對比、undo → 匯出 JPEG（可選品質）→ 預設集存檔 / 匯出 / 匯入 JSON。網頁上線。 |
| **v0.2** | 曲線（點曲線 RGB/R/G/B + 參數式曲線）、HSL 混色器 8 色（色相/飽和度/明度）、色彩分級色輪、直方圖。**到這版你列的參數全部齊。** |
| **v0.3** | Android 殼 + 加入家族：WebView 殼（抄 wordcards）、`ToneBridge` 把照片存進相簿（MediaStore `Pictures/Routina Tone`）與預設集檔案（SAF）、家族 meta-data、Hub `apps.json` 加一筆、CI 發 APK。 |
| **v0.4** | 匯入 Lightroom `.xmp` 預設集；HEIC（App 端用 Android `ImageDecoder` 原生解碼；網頁端需要時才載入 WASM 解碼器）。 |
| **v0.5** | 效果：清晰度、紋理、去霧、銳化、顆粒、暗角；匯出改成分塊渲染支援大圖。 |
| **v0.6** | 裁切 / 旋轉 / 拉直。 |
| **v0.7** | 批次：一個預設集套到多張照片並一次匯出。 |
| **v0.8** | 局部調整：漸層、放射狀、筆刷遮罩，每個遮罩有自己的一組參數。 |

## 要事先知道的坑

- **Android WebView 不處理 `blob:` 下載**，wordcards 的匯出在 App 裡本來就是壞的。Tone 的存檔一定要走 JS bridge（v0.3）。
- WebView 載入要用 `https://appassets.androidplatform.net/routina-tone/`（真正的 https origin），IndexedDB 才可靠。
- `canvas.toBlob` 會丟掉全部 EXIF；如果要保留拍攝時間，要自己把 EXIF 寫回去（Orientation 要改成 1）。
- 手機大圖很吃記憶體：48 MP 的 RGBA16F 一張 buffer 大約 384 MB → 預覽一律用縮圖，只有匯出時才碰原圖。
- 預覽和匯出的空間半徑（模糊、清晰度）要依圖片尺寸縮放，否則預覽看起來和匯出的不一樣。
- HEIC 在 Chromium 的支援看系統解碼器，不可靠 → 決定走原生解碼。
