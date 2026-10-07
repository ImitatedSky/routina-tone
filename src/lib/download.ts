export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 延後釋放，部分瀏覽器在 click 之後才開始讀
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// 檔名不能有的字元換成底線
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'untitled'
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

// 匯出的檔名：原檔名-tone.jpg，像素畫是 PNG
export function exportName(original: string, blob: Blob): string {
  return `${safeFilename(baseName(original))}-tone.${blob.type === 'image/png' ? 'png' : 'jpg'}`
}
