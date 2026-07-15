import { createContext, useContext } from 'react';

export type Language = 'ja' | 'en';

const dictionary = {
  ja: {
    appName: 'RepoShelf',
    tagline: 'あなたのプライベートリポジトリを、読みやすく。',
    menu: 'メニュー',
    search: '検索',
    theme: 'テーマ切り替え',
    connections: '接続先',
    select: '接続先とファイルを選択してください。',
    library: '接続先ライブラリ',
    saved: '登録済み',
    add: '追加',
    close: '閉じる',
    root: 'ルート',
    last: '前回',
    edit: '編集',
    remove: '削除',
    none: 'まだ接続先がありません。「追加」から最初のリポジトリを登録してください。',
    fileHint: 'ファイル名やパスを入力して検索',
    contentHint: '検索語を入力するとMarkdown本文を検索します',
    currentHint: '現在のファイル内を検索',
    file: 'ファイル',
    content: '本文',
    current: '現在',
    clear: '検索をクリア',
    addRepo: '接続先を追加',
    editRepo: '接続先を編集',
    displayName: '表示名',
    repository: '対象リポジトリ',
    rootPath: 'ルートパス（省略可）',
    tokenRequired: 'Personal Access Token は必須です',
    invalidRepo: 'owner/repo の形式で入力してください',
    cancel: 'キャンセル',
    save: '保存して開く',
    cachePdf: 'PDFを端末にキャッシュ',
    loading: '待機中...',
  },
  en: {
    appName: 'RepoShelf',
    tagline: 'Your private repository, made readable.',
    menu: 'Menu',
    search: 'Search',
    theme: 'Switch theme',
    connections: 'Repositories',
    select: 'Select a repository and a file to get started.',
    library: 'Repository Library',
    saved: 'Saved repositories',
    add: 'Add',
    close: 'Close',
    root: 'Root',
    last: 'Last used',
    edit: 'Edit',
    remove: 'Delete',
    none: 'No repositories yet. Select “Add” to connect your first repository.',
    fileHint: 'Search by file name or path',
    contentHint: 'Enter a query to search Markdown content',
    currentHint: 'Search within the current file',
    file: 'Files',
    content: 'Content',
    current: 'Current',
    clear: 'Clear search',
    addRepo: 'Add repository',
    editRepo: 'Edit repository',
    displayName: 'Display name',
    repository: 'Repository',
    rootPath: 'Root path (optional)',
    tokenRequired: 'Personal Access Token is required',
    invalidRepo: 'Enter a repository in owner/repo format',
    cancel: 'Cancel',
    save: 'Save and open',
    cachePdf: 'Cache PDFs on this device',
    loading: 'Loading...',
  },
} as const;

const Context = createContext({
  language: 'ja' as Language,
  setLanguage: (_: Language) => {},
  t: dictionary.ja,
});
export function I18nProvider({
  language,
  setLanguage,
  children,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  children: React.ReactNode;
}) {
  return (
    <Context.Provider value={{ language, setLanguage, t: dictionary[language] }}>{children}</Context.Provider>
  );
}
export function useI18n() {
  return useContext(Context);
}
