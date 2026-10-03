// 各處共用的字
const zh = {
  appTitle: 'Routina Tone — 照片調色',
  reset: '重設',
  resetSection: (title: string) => `重設${title}`,
  delete: '刪除',
  save: '儲存',
  cancel: '取消',
  close: '關閉',
  typeValue: (name: string) => `輸入${name}的數值`,
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
    typeValue: (name: string) => `Type a value for ${name}`,
  } satisfies typeof zh,
}
