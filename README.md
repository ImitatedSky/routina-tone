# Routina Tone

照片調色 App，網頁版：https://imitatedsky.github.io/routina-tone/

Android 版是 Routina 家族的一員，從 Routina Hub 安裝，或到 [Releases](https://github.com/ImitatedSky/routina-tone/releases) 下載 `routina-tone-v*.apk`。規劃與版本路線見 [PLAN.md](PLAN.md)。

## 功能

- **光線**：曝光、對比、亮部、陰影、白色、黑色
- **色彩**：色溫、色調、自然飽和度、飽和度
- **曲線**：RGB／紅／綠／藍點曲線，加上參數式區域曲線（亮部、亮調、暗調、陰影與三個分界點）
- **混色器**：8 個色帶的色相／飽和度／明度（在 OKLCH 裡調，改色相時亮度不跳）
- **色彩分級**：陰影／中間調／亮部／全局四個色輪，加上混合與平衡
- **效果**：紋理、清晰度、去朦朧、銳利化（總量／半徑／細節／遮色片）、雜色減少（明度、明度細節、色彩、色彩細節）、暗角（含亮部保留）、顆粒
- **遮罩（局部調整）**：線性漸層、放射狀漸層（羽化、反轉）、筆刷（大小、羽化、橡皮擦），最多 8 個；每個遮罩有自己的曝光、對比、亮部、陰影、色溫、色調、飽和度、清晰度、紋理、去朦朧；可以把遮罩範圍塗紅顯示。遮罩黏在照片內容上，裁切拉直後不會跑掉；不存進預設集
- **裁切**：自由／原始／1:1／4:5／3:2／16:9、拉直 ±45°（裁切框自動縮到照片內）、90° 旋轉、水平翻轉。裁切不存進預設集（和 Lightroom 一樣）
- **像素畫**：把照片轉成真正對齊格線的像素畫（每格一個顏色），可調格數、調色盤（自動減色、16 位元主機、Game Boy、PICO-8、NES）、色數、抖色（網點／擴散），以整數倍放大匯出 PNG
- 介面有繁體中文與英文，預設跟隨系統，⚙ 設定可切換
- 每個滑桿點右邊的數字都能直接輸入數值（曲線的點、分級色輪也可以）
- RGB 直方圖；雙指縮放、放大後單指平移、雙擊放大；照片與操作面板之間的 ▼ 可收起面板全螢幕看圖；按住照片看原圖；雙擊滑桿歸零；Ctrl+Z / Ctrl+Shift+Z
- 以原始尺寸匯出 JPEG，大圖分塊渲染，不受 GPU 貼圖上限限制
- 批次處理：把目前的設定或某個預設集套到多張照片並全部匯出（不套用裁切）
- 開 JPEG、PNG、WebP、HEIC（HEIC 在瀏覽器不支援時才載入 WASM 解碼器）
- 預設集：★ 常用（置頂）、群組（可收合，群組在前、未分組在後）、可調整順序、儲存、匯出成 `.tone.json`、複製成 JSON 文字；匯入檔案（`.tone.json`、Lightroom `.xmp`）或貼上文字
- 重新整理後自動還原上次編輯的照片與參數

## 開發

```sh
npm install
npm run dev
npm test
npm run build
```

## 架構

| 目錄 | 內容 |
|---|---|
| `src/engine/` | 參數定義、白平衡／曲線 LUT／分級與混色的數值（TS 算）、去霧分析、GLSL shader、WebGL2 renderer |
| `src/photo/` | 解碼（依 EXIF 轉正、縮預覽圖、HEIC）、分塊匯出 JPEG |
| `src/presets/` | 預設集檔案格式、Lightroom .xmp 匯入 |
| `src/storage/` | IndexedDB：預設集、目前的編輯 |
| `src/editor/` | 編輯狀態（zustand，含 undo/redo） |
| `src/components/` | 介面（`panels/` 是曲線、混色器、色彩分級） |

### Android 殼（`android/`）

整個畫面是一個 WebView，載入打包進 APK 的 `dist/`（掛在 `https://appassets.androidplatform.net/routina-tone/`，IndexedDB 才可靠）。零權限。

WebView 不處理 `blob:` 下載，所以存檔走 JS bridge：網頁的 `src/lib/saveFile.ts` 在 App 裡呼叫 `RoutinaToneFiles.saveFile(...)`（`FileSaver.kt`）。照片在 Android 10 以上存進相簿 `Pictures/Routina Tone`，Android 8–9 和預設集跳系統的「另存新檔」。

```sh
npm run build
cd android && ./gradlew :app:assembleRelease
```

發版：`android/app/build.gradle.kts` 的 `versionName` 改好 → commit → `git tag vX.Y.Z` → push tag。CI（`.github/workflows/android.yml`）檢查 tag 與 versionName 一致後簽章並建 Release。

### 設計

由參數算出來的東西（矩陣、之後的曲線 LUT）在 TS 端算好傳進 shader，shader 只負責逐像素套用，色彩數學才能用 vitest 測。

### 預設集格式

```json
{
  "format": "routina-tone-preset",
  "version": 1,
  "name": "暖色",
  "adjustments": { "temp": 12, "exposure": 0.3 }
}
```

`adjustments` 只存和預設值不同的欄位，讀取時補預設值、夾在範圍內、忽略不認得的欄位。參數單位和 Lightroom 一致（曝光是 EV，其他是 -100..100）。

### 渲染管線

- **分析圖**（和預覽同尺寸的縮圖）：清晰度的大範圍模糊底圖、去霧的暗通道與大氣光（CPU 上算，guided filter 修邊）。預覽與匯出用同一種縮圖，結果一致。
- **目標**（預覽的整張縮圖，或匯出時原圖的一塊）：紋理與銳利化的模糊底圖，依目標實際解析度算。
- **調色 pass**：一個 fragment shader 依序做完所有調整，順序見 `src/engine/shaders.ts` 開頭的說明。
- 模糊半徑都以照片長邊的比例定義，所以預覽和匯出看起來一樣；分塊匯出時每塊多讀一圈邊，接縫處和整張一起算時相同。

### Lightroom .xmp

參數名稱可以一對一對應（`src/presets/xmp.ts`），但 Adobe 的算法沒公開，套出來只會接近、不會完全一樣。描述檔（Look）、遮罩、相機描述檔、裁切、鏡頭校正會略過並提示。

## 第三方授權

HEIC 解碼使用 [libheif-js](https://github.com/catdad-experiments/libheif-js)（內含 libheif 與 libde265），授權為 LGPL-3.0。只在開啟 HEIC 且瀏覽器本身不支援時才載入。
