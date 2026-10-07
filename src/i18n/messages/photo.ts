// 開檔、解碼、匯出、存檔、渲染的錯誤訊息
const zh = {
  openFailed: '開啟照片失敗',
  unsupportedFormat: '無法讀取這張照片，請使用 JPEG、PNG、WebP 或 HEIC',
  heicFailed: '無法讀取這張 HEIC 照片',
  outputCanvasFailed: '無法建立輸出畫布，照片可能太大',
  jpegEncodeFailed: 'JPEG 編碼失敗',
  pngEncodeFailed: 'PNG 編碼失敗',
  noWebgl2: '這個瀏覽器不支援 WebGL2，無法調色',
  imageTooLarge: (width: number, height: number) => `圖片太大（${width}×${height}），瀏覽器無法處理`,

  // Android 存檔 bridge 回傳的代碼
  savedToGallery: '已存到相簿 Pictures/Routina Tone',
  savedDocument: '已儲存',
  saveFailed: '儲存失敗',
  saveDecodeFailed: '無法讀取要儲存的檔案',
  saveGalleryFailed: '存到相簿失敗',
  saveDialogFailed: '無法開啟儲存對話框',
  saveWriteFailed: '寫入檔案失敗',
  withDetail: (message: string, detail: string) => `${message}：${detail}`,
  readFileFailed: '讀取檔案失敗',
}

export const photo = {
  'zh-Hant': zh,
  en: {
    openFailed: "Couldn't open the photo",
    unsupportedFormat: "Couldn't read this photo. Please use JPEG, PNG, WebP or HEIC",
    heicFailed: "Couldn't read this HEIC photo",
    outputCanvasFailed: "Couldn't create the output canvas. The photo may be too large",
    jpegEncodeFailed: 'JPEG encoding failed',
    pngEncodeFailed: 'PNG encoding failed',
    noWebgl2: "This browser doesn't support WebGL2, so photos can't be edited",
    imageTooLarge: (width: number, height: number) => `The image is too large (${width}×${height}) for this browser`,

    savedToGallery: 'Saved to Pictures/Routina Tone',
    savedDocument: 'Saved',
    saveFailed: 'Save failed',
    saveDecodeFailed: "Couldn't read the file to save",
    saveGalleryFailed: "Couldn't save to the gallery",
    saveDialogFailed: "Couldn't open the save dialog",
    saveWriteFailed: "Couldn't write the file",
    withDetail: (message: string, detail: string) => `${message}: ${detail}`,
    readFileFailed: "Couldn't read the file",
  } satisfies typeof zh,
}
