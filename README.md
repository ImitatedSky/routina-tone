# Routina Tone

照片調色 App，網頁版：https://imitatedsky.github.io/routina-tone/

之後會包成 Android App 加入 Routina 家族。規劃與版本路線見 [PLAN.md](PLAN.md)。

## 功能（v0.1）

- 白平衡：色溫、色調
- 色調：曝光、對比、亮部、陰影、白色、黑色
- 飽和度：自然飽和度、飽和度
- 按住照片（或眼睛按鈕）看原圖；雙擊滑桿歸零；Ctrl+Z / Ctrl+Shift+Z
- 以原始尺寸匯出 JPEG
- 預設集：儲存、匯出成 `.tone.json`、匯入
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
| `src/engine/` | 參數定義、白平衡矩陣（TS 算）、GLSL shader、WebGL2 renderer |
| `src/photo/` | 解碼（依 EXIF 轉正、縮預覽圖）、匯出 JPEG |
| `src/presets/` | 預設集檔案格式 |
| `src/storage/` | IndexedDB：預設集、目前的編輯 |
| `src/editor/` | 編輯狀態（zustand，含 undo/redo） |
| `src/components/` | 介面 |

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
