// 各處共用的字
const zh = {
  appTitle: 'Routina Tone — 照片調色',
  reset: '重設',
  resetSection: (title: string) => `重設${title}`,
  delete: '刪除',
  save: '儲存',
  cancel: '取消',
  close: '關閉',
}

export const common = {
  'zh-Hant': zh,
  en: {
    appTitle: 'Routina Tone — Photo editor',
    reset: 'Reset',
    resetSection: (title: string) => `Reset ${title}`,
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
  } satisfies typeof zh,
}
