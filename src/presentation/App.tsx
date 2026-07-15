import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { loadMarkdown, loadPdfBytes } from '../application/document/loadDocument';
import { loadRepositoryIndex } from '../application/repository/loadRepositoryIndex';
import { searchMarkdownContent } from '../application/search/searchContent';
import type { RepositoryProfile, RepositoryProfileInput, ViewerFile } from '../domain/models';
import { fileTypeFromName } from '../domain/profile';
import {
  getActiveProfile,
  getLastOpenedFile,
  getRepositoryProfiles,
  persistLegacySettings,
  removeRepositoryProfile,
  saveLastOpenedFile,
  saveRepositoryProfile,
  setActiveProfileId,
} from '../infrastructure/storage/repositoryProfiles';
import { Icon } from './components/Icon';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MarkdownViewer } from './components/MarkdownViewer';
import { PdfViewer } from './components/PdfViewer';
import { RepositoryProfileModal } from './components/RepositoryProfileModal';

type SearchMode = 'file' | 'content' | 'current';
type SearchResultFile = ViewerFile & { fragment?: string };

function getUrlFilePath() {
  const hashPrefix = '#/file/';
  if (window.location.hash.startsWith(hashPrefix)) {
    return window.location.hash
      .slice(hashPrefix.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');
  }
  return new URL(window.location.href).searchParams.get('file') || '';
}

function setUrlFilePath(filePath: string, replace = false) {
  const hash = filePath ? `/file/${filePath.split('/').map(encodeURIComponent).join('/')}` : '';
  if (window.location.hash === `#${hash}`) return;
  if (replace) window.history.replaceState({ filePath }, '', `#${hash}`);
  else window.history.pushState({ filePath }, '', `#${hash}`);
}

function iconForFile(file: ViewerFile) {
  return file.type === 'pdf' ? 'picture_as_pdf' : 'description';
}

function formatResultPath(profile: RepositoryProfile, path: string) {
  if (!profile.rootPath) return path;
  return path.replace(new RegExp(`^${profile.rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '');
}

export function DocsViewerApp() {
  const queryClient = useQueryClient();
  const [profiles, setProfiles] = useState<RepositoryProfile[]>(() => getRepositoryProfiles());
  const [activeProfile, setActiveProfile] = useState<RepositoryProfile | null>(() => getActiveProfile());
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RepositoryProfile | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(() => !getActiveProfile());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme_preference') || 'dark');
  const [currentFile, setCurrentFile] = useState<ViewerFile | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('file');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme_preference', theme);
  }, [theme]);

  const repositoryIndex = useQuery({
    queryKey: ['repositoryIndex', activeProfile?.id],
    queryFn: ({ signal }) => loadRepositoryIndex(activeProfile!, signal),
    enabled: Boolean(activeProfile),
  });

  const markdownQuery = useQuery({
    queryKey: ['markdown', activeProfile?.id, currentFile?.sha],
    queryFn: ({ signal }) => loadMarkdown(activeProfile!, currentFile!, signal),
    enabled: Boolean(activeProfile && currentFile?.type === 'md'),
  });

  const pdfQuery = useQuery({
    queryKey: ['pdf', activeProfile?.id, currentFile?.sha],
    queryFn: ({ signal }) => loadPdfBytes(activeProfile!, currentFile!, signal),
    enabled: Boolean(activeProfile && currentFile?.type === 'pdf'),
  });

  const contentSearch = useQuery({
    queryKey: ['markdownSearch', activeProfile?.id, searchQuery],
    queryFn: ({ signal }) => searchMarkdownContent(activeProfile!, searchQuery, signal),
    enabled: Boolean(activeProfile && searchMode === 'content' && searchQuery),
  });

  const fileResults = useMemo(() => {
    if (!repositoryIndex.data || !searchQuery) return [];
    const needle = searchQuery.toLowerCase();
    return repositoryIndex.data.files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [repositoryIndex.data, searchQuery]);

  const currentMatches = useMemo(() => {
    if (!searchQuery || !markdownQuery.data || currentFile?.type !== 'md') return 0;
    return markdownQuery.data.toLowerCase().split(searchQuery.toLowerCase()).length - 1;
  }, [currentFile?.type, markdownQuery.data, searchQuery]);

  useEffect(() => {
    if (!activeProfile || !repositoryIndex.data || currentFile) return;
    const urlFilePath = getUrlFilePath();
    const lastOpened = getLastOpenedFile(activeProfile);
    const targetPath = urlFilePath || lastOpened?.file.path || '';
    if (!targetPath) return;
    const file = repositoryIndex.data.files.find((item) => item.path === targetPath) || lastOpened?.file;
    if (file) openFile({ ...file, type: file.type || fileTypeFromName(file.name) }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile, repositoryIndex.data]);

  function refreshProfiles(nextActive?: RepositoryProfile | null) {
    const nextProfiles = getRepositoryProfiles();
    setProfiles(nextProfiles);
    if (nextActive !== undefined) setActiveProfile(nextActive);
  }

  function openRepository(profile: RepositoryProfile) {
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
    persistLegacySettings(profile);
    setCurrentFile(null);
    setLibraryOpen(false);
    setProfileModalOpen(false);
    setEditingProfile(null);
    setSidebarOpen(true);
    setUrlFilePath('', true);
    queryClient.invalidateQueries({ queryKey: ['repositoryIndex', profile.id] });
  }

  function saveProfile(values: RepositoryProfileInput) {
    const profile = saveRepositoryProfile(values);
    refreshProfiles(profile);
    openRepository(profile);
  }

  function openFile(file: ViewerFile, replaceUrl = false) {
    if (!activeProfile) return;
    const normalizedFile = { ...file, type: file.type || fileTypeFromName(file.name) };
    setCurrentFile(normalizedFile);
    saveLastOpenedFile(activeProfile, normalizedFile);
    setSidebarOpen(false);
    setUrlFilePath(normalizedFile.path, replaceUrl);
  }

  function removeProfile(id: string) {
    removeRepositoryProfile(id);
    const next = getActiveProfile();
    refreshProfiles(next);
    if (activeProfile?.id === id) {
      setActiveProfile(next);
      setCurrentFile(null);
      setLibraryOpen(!next);
    }
  }

  const isLoading =
    repositoryIndex.isFetching || markdownQuery.isFetching || pdfQuery.isFetching || contentSearch.isFetching;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-gray-50 text-gray-900 transition-colors selection:bg-blue-200 selection:text-blue-900 dark:bg-dracula-bg dark:text-dracula-fg dark:selection:bg-dracula-current dark:selection:text-dracula-cyan">
      <LoadingOverlay visible={isLoading} />
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white p-3 shadow-sm dark:border-dracula-current dark:bg-dracula-sidebar">
        <div className="flex min-w-0 items-center">
          <button
            className="icon-btn mr-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            title="メニュー"
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
          >
            <Icon name="menu" />
          </button>
          <h1 className="max-w-[180px] truncate text-lg font-bold text-gray-800 dark:text-dracula-purple">
            {currentFile?.name || activeProfile?.name || 'Docs Viewer'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="icon-btn text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            title="検索"
            type="button"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="search" />
          </button>
          <button
            className="icon-btn text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            title="テーマ切り替え"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          <button
            className="rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            type="button"
            onClick={() => setLibraryOpen(true)}
          >
            接続先
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen ? (
          <button
            aria-label="サイドバーを閉じる"
            className="absolute inset-0 z-30 bg-black/40 md:hidden"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <aside
          className={`absolute inset-y-0 left-0 z-40 flex h-full w-80 max-w-[86vw] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform dark:border-dracula-current dark:bg-dracula-sidebar md:relative md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SearchPanel
            activeProfile={activeProfile}
            contentItems={contentSearch.data || []}
            currentMatches={currentMatches}
            fileResults={fileResults}
            mode={searchMode}
            onOpenFile={openFile}
            query={searchQuery}
            setMode={setSearchMode}
            setQuery={setSearchQuery}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <FileList
              activePath={currentFile?.path}
              files={repositoryIndex.data?.files || []}
              onOpenFile={openFile}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-dracula-bg">
          {!currentFile ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-gray-500 dark:text-dracula-comment">
              接続先とファイルを選択してください。
            </div>
          ) : currentFile.type === 'md' ? (
            markdownQuery.data ? (
              <MarkdownViewer markdown={markdownQuery.data} />
            ) : null
          ) : pdfQuery.data ? (
            <PdfViewer bytes={pdfQuery.data} />
          ) : null}
        </main>
      </div>

      <RepositoryLibrary
        activeProfile={activeProfile}
        onAdd={() => {
          setEditingProfile(null);
          setProfileModalOpen(true);
        }}
        onClose={() => setLibraryOpen(false)}
        onEdit={(profile) => {
          setEditingProfile(profile);
          setProfileModalOpen(true);
        }}
        onOpen={openRepository}
        onRemove={removeProfile}
        open={libraryOpen}
        profiles={profiles}
      />

      <RepositoryProfileModal
        onClose={() => setProfileModalOpen(false)}
        onSubmit={saveProfile}
        open={profileModalOpen}
        profile={editingProfile}
      />
    </div>
  );
}

type RepositoryLibraryProps = {
  open: boolean;
  profiles: RepositoryProfile[];
  activeProfile: RepositoryProfile | null;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (profile: RepositoryProfile) => void;
  onOpen: (profile: RepositoryProfile) => void;
  onRemove: (id: string) => void;
};

function RepositoryLibrary({
  activeProfile,
  onAdd,
  onClose,
  onEdit,
  onOpen,
  onRemove,
  open,
  profiles,
}: RepositoryLibraryProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50 p-4 dark:bg-dracula-bg">
      <div className="w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-dracula-current dark:bg-dracula-sidebar">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-dracula-cyan">
              Repository Library
            </p>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-dracula-purple">接続先ライブラリ</h2>
          </div>
          <button
            className="icon-btn -mr-2 -mt-2 text-gray-500 hover:bg-gray-100 dark:text-dracula-comment dark:hover:bg-dracula-current"
            title="閉じる"
            type="button"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-dracula-current">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dracula-fg">登録済み</h3>
          <button
            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-100 dark:border-dracula-cyan/40 dark:bg-dracula-bg dark:text-dracula-cyan dark:hover:bg-dracula-current"
            type="button"
            onClick={onAdd}
          >
            <Icon className="text-[16px]" name="add" />
            追加
          </button>
        </div>
        <div className="grid gap-2">
          {profiles.map((profile) => (
            <div
              className="rounded border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-dracula-current dark:bg-dracula-bg dark:hover:border-dracula-comment"
              key={profile.id}
            >
              <div className="flex items-center justify-between gap-3">
                <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onOpen(profile)}>
                  <div className="truncate text-base font-semibold leading-6 text-gray-800 dark:text-dracula-fg">
                    {profile.name}
                  </div>
                  <div className="truncate text-sm leading-5 text-gray-500 dark:text-dracula-comment">
                    {profile.rootPath ? `${profile.repo} / ${profile.rootPath}` : `${profile.repo} / ルート`}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {profile.id === activeProfile?.id ? (
                    <span className="inline-flex h-7 items-center rounded bg-blue-100 px-2 text-[11px] font-medium leading-none text-blue-700 dark:bg-dracula-current dark:text-dracula-cyan">
                      前回
                    </span>
                  ) : null}
                  <button
                    className="icon-btn !h-7 !w-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-dracula-cyan dark:hover:bg-dracula-current"
                    title="編集"
                    type="button"
                    onClick={() => onEdit(profile)}
                  >
                    <Icon className="text-[16px]" name="edit" />
                  </button>
                  <button
                    className="icon-btn !h-7 !w-7 text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-dracula-red dark:hover:bg-dracula-current"
                    title="削除"
                    type="button"
                    onClick={() => onRemove(profile.id)}
                  >
                    <Icon className="text-[16px]" name="delete" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {profiles.length === 0 ? (
            <p className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-dracula-current dark:text-dracula-comment">
              まだ接続先がありません。「追加」から最初のリポジトリを登録してください。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FileList({
  activePath,
  files,
  onOpenFile,
}: {
  activePath?: string;
  files: ViewerFile[];
  onOpenFile: (file: ViewerFile) => void;
}) {
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <button
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
            activePath === file.path
              ? 'bg-blue-50 text-blue-700 dark:bg-dracula-current dark:text-dracula-cyan'
              : 'text-gray-700 hover:bg-gray-100 dark:text-dracula-fg dark:hover:bg-dracula-current/70'
          }`}
          key={file.path}
          title={file.path}
          type="button"
          onClick={() => onOpenFile(file)}
        >
          <Icon
            className={
              file.type === 'pdf' ? 'shrink-0 text-red-500' : 'shrink-0 text-blue-600 dark:text-dracula-cyan'
            }
            name={iconForFile(file)}
          />
          <span className="min-w-0 truncate">{file.name}</span>
        </button>
      ))}
    </div>
  );
}

type SearchPanelProps = {
  activeProfile: RepositoryProfile | null;
  mode: SearchMode;
  query: string;
  setMode: (mode: SearchMode) => void;
  setQuery: (query: string) => void;
  fileResults: ViewerFile[];
  contentItems: Array<ViewerFile & { fragment?: string }>;
  currentMatches: number;
  onOpenFile: (file: ViewerFile) => void;
};

function SearchPanel({
  activeProfile,
  contentItems,
  currentMatches,
  fileResults,
  mode,
  onOpenFile,
  query,
  setMode,
  setQuery,
}: SearchPanelProps) {
  const visibleResults: SearchResultFile[] = mode === 'file' ? fileResults : contentItems;
  const status = !query
    ? mode === 'file'
      ? 'ファイル名やパスを入力して検索'
      : mode === 'content'
        ? '検索語を入力するとMarkdown本文を検索します'
        : '現在のファイル内を検索'
    : mode === 'file'
      ? `${fileResults.length}件のファイル`
      : mode === 'content'
        ? `${contentItems.length}件の本文一致`
        : `${currentMatches}件の一致`;

  return (
    <div className="shrink-0 space-y-3 border-b border-gray-200 p-3 dark:border-dracula-current">
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400" name="search" />
        <input
          className="w-full rounded border border-gray-200 bg-gray-50 py-2 pl-9 pr-10 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-fg dark:focus:border-dracula-cyan"
          placeholder="検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            className="icon-btn absolute right-1 top-1/2 !h-8 !w-8 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:text-dracula-comment dark:hover:text-dracula-fg"
            title="検索をクリア"
            type="button"
            onClick={() => setQuery('')}
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1 rounded border border-gray-200 bg-gray-100 p-1 dark:border-dracula-current dark:bg-dracula-bg">
        {(['file', 'content', 'current'] as const).map((item) => (
          <button
            className={`rounded px-2 py-1.5 text-sm ${
              mode === item
                ? 'bg-white text-blue-700 shadow-sm dark:bg-dracula-current dark:text-dracula-cyan'
                : 'text-gray-500 dark:text-dracula-comment'
            }`}
            key={item}
            type="button"
            onClick={() => setMode(item)}
          >
            {item === 'file' ? 'ファイル' : item === 'content' ? '本文' : '現在'}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-dracula-comment">{status}</p>
      {query && mode !== 'current' ? (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {visibleResults.slice(0, 60).map((file) => (
            <button
              className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-dracula-fg dark:hover:bg-dracula-current"
              key={file.path}
              type="button"
              onClick={() => onOpenFile(file)}
            >
              <Icon
                className={file.type === 'pdf' ? 'shrink-0 text-red-500' : 'shrink-0 text-blue-600'}
                name={iconForFile(file)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{file.name}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-dracula-comment">
                  {activeProfile ? formatResultPath(activeProfile, file.path) : file.path}
                </span>
                {file.fragment ? (
                  <span className="line-clamp-2 block text-xs text-gray-600 dark:text-dracula-comment">
                    {file.fragment}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
