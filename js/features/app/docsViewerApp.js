import { fetchBlob, searchMarkdownCode } from '../../api/github.js';
import { getDomElements } from '../../core/dom.js';
import { createMarkdownRenderer } from '../../markdown/renderer.js';
import { MOBILE_MAX_BYTES, PdfBlobCache } from '../cache/pdfBlobCache.js';
import { LoadingController, isAbortError } from '../loading/loadingController.js';
import { SidebarController } from '../navigation/sidebarController.js';
import { fileTypeFromName, normalizeRootPath, RepositoryIndex } from '../repository/repositoryIndex.js';
import { CurrentFileSearchController } from '../search/currentFileSearch.js';
import { setupKeyboardShortcuts } from '../shortcuts/keyboardShortcuts.js';
import { LastOpenedFileStore } from '../storage/lastOpenedFile.js';
import { RepositoryProfileStore } from '../storage/repositoryProfiles.js';
import { ThemeController } from '../theme/themeController.js';
import { PdfZoomController } from '../zoom/pdfZoomController.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const md = createMarkdownRenderer();
const repositoryProfileStore = new RepositoryProfileStore();
const activeProfile = repositoryProfileStore.getActive();

let settings = activeProfile || { repo: '', path: '', token: '', cachePdfBlobs: false };
let pdfDoc = null;
let pageObserver = null;
const zoomState = { current: 100 };
let activeTreeItem = null;
let searchMode = 'file';
let searchTimer = null;
let currentFile = null;
let isRestoringHistory = false;
const BASE_MAX_WIDTH = 800;
const DESKTOP_PDF_BASE_SCALE = 0.75;
const LAST_FILE_KEY = 'github_docs_last_opened_file';
const PDF_CACHE_SETTING_KEY = 'github_cache_pdf_blobs';

const {
    treeRoot,
    scrollContainer,
    emptyState,
    pdfWrapper,
    mdWrapper,
    zoomControls,
    zoomLevelText,
    sidebar,
    sidebarOverlay,
    themeToggleBtn,
    themeToggleIcon,
    mdStyle,
    hlStyle,
    searchInput,
    clearSearchBtn,
    searchStatus,
    searchResults,
    repositoryList,
    repositoryEmptyState,
    repositoryFormPanel,
    repositoryFormTitle,
    newRepositoryBtn,
    closeRepositoryLibraryBtn,
    closeRepositoryFormBtn,
    cancelRepositoryFormBtn,
    displayNameInput,
    tokenInput,
    toggleTokenVisibilityBtn,
    pdfCacheInput,
    pdfCacheHelp,
    currentSearchBar,
    currentSearchInput,
    currentSearchCount,
    currentPrevBtn,
    currentNextBtn,
    shortcutsModal,
    loading,
    cancelLoadingBtn
} = getDomElements();
const loadingController = new LoadingController({ overlay: loading });
const sidebarController = new SidebarController({ sidebar, overlay: sidebarOverlay });
const themeController = new ThemeController({ themeToggleIcon, mdStyle, hlStyle });
const lastOpenedFileStore = new LastOpenedFileStore(LAST_FILE_KEY);
const repositoryIndex = new RepositoryIndex(() => settings);
const pdfBlobCache = new PdfBlobCache({ isMobile: () => !isDesktopLayout() });
const currentFileSearch = new CurrentFileSearchController({
    mdWrapper,
    pdfWrapper,
    currentSearchBar,
    currentSearchInput,
    currentSearchCount,
    currentPrevBtn,
    currentNextBtn,
    searchInput,
    clearSearchBtn,
    getCurrentFile: () => currentFile,
    getPdfDoc: () => pdfDoc
});
const pdfZoomController = new PdfZoomController({
    scrollContainer,
    pdfWrapper,
    zoomState,
    updateZoomUI
});

themeController.applySavedTheme();
pdfZoomController.attach();

themeToggleBtn.addEventListener('click', () => themeController.toggle());

const toggleSidebar = (forceState) => sidebarController.toggle(forceState);
const handleFileClick = () => sidebarController.closeOnMobile();
const isDesktopLayout = () => window.matchMedia('(min-width: 768px)').matches;
const getPdfBaseWidth = () => BASE_MAX_WIDTH * (isDesktopLayout() ? DESKTOP_PDF_BASE_SCALE : 1);
const isEditableTarget = (target) => target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

function createIcon(name, className = '') {
    const icon = document.createElement('span');
    icon.className = `material-symbols-outlined ${className}`.trim();
    icon.textContent = name;
    return icon;
}

function applySettings(nextSettings) {
    settings = {
        repo: nextSettings.repo || '',
        path: nextSettings.path || '',
        token: nextSettings.token || '',
        displayName: nextSettings.displayName || '',
        cachePdfBlobs: Boolean(nextSettings.cachePdfBlobs)
    };
    displayNameInput.value = settings.displayName;
    document.getElementById('repo-input').value = settings.repo;
    document.getElementById('path-input').value = settings.path;
    tokenInput.value = settings.token;
    pdfCacheInput.checked = settings.cachePdfBlobs;
    updatePdfCacheHelp();
}

function setTokenVisibility(visible) {
    tokenInput.type = visible ? 'text' : 'password';
    toggleTokenVisibilityBtn.title = visible ? 'トークンを隠す' : 'トークンを表示';
    const icon = toggleTokenVisibilityBtn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = visible ? 'visibility_off' : 'visibility';
}

function showRepositoryForm(title = '接続先を追加') {
    repositoryFormPanel.classList.remove('hidden');
    repositoryFormPanel.classList.add('flex');
    repositoryFormTitle.textContent = title;
    setTokenVisibility(false);
}

function hideRepositoryForm() {
    repositoryFormPanel.classList.add('hidden');
    repositoryFormPanel.classList.remove('flex');
}

function resetRepositoryForm() {
    applySettings({ repo: '', path: '', token: '', displayName: '', cachePdfBlobs: false });
    showRepositoryForm('接続先を追加');
    document.getElementById('repo-input').focus();
}

function renderRepositoryProfiles() {
    const profiles = repositoryProfileStore.getAll();
    const activeId = repositoryProfileStore.getActiveId();
    repositoryList.innerHTML = '';
    repositoryEmptyState.classList.toggle('hidden', profiles.length > 0);
    closeRepositoryLibraryBtn.classList.toggle('hidden', !settings.repo || !settings.token);

    profiles.forEach(profile => {
        const card = document.createElement('div');
        card.className = 'rounded border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-dracula-current dark:bg-dracula-bg dark:hover:border-dracula-comment';
        card.dataset.profileId = profile.id;

        const top = document.createElement('div');
        top.className = 'flex items-center justify-between gap-3';

        const text = document.createElement('button');
        text.type = 'button';
        text.className = 'min-w-0 flex-1 text-left';
        text.title = profile.name;
        text.addEventListener('click', () => openRepository(profile));

        const name = document.createElement('div');
        name.className = 'truncate text-base font-semibold leading-6 text-gray-800 dark:text-dracula-fg';
        name.textContent = profile.name;
        const path = document.createElement('div');
        path.className = 'truncate text-sm leading-5 text-gray-500 dark:text-dracula-comment';
        path.textContent = profile.path ? `${profile.repo} / ${profile.path}` : `${profile.repo} / ルート`;
        text.appendChild(name);
        text.appendChild(path);

        const actions = document.createElement('div');
        actions.className = 'flex shrink-0 items-center gap-1';

        const activeBadge = document.createElement('span');
        activeBadge.className = 'inline-flex h-7 items-center rounded bg-blue-100 px-2 text-[11px] font-medium leading-none text-blue-700 dark:bg-dracula-current dark:text-dracula-cyan';
        activeBadge.textContent = '前回';
        activeBadge.hidden = profile.id !== activeId;

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'icon-btn !h-7 !w-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-dracula-cyan dark:hover:bg-dracula-current';
        editButton.title = '編集';
        editButton.appendChild(createIcon('edit', 'text-[16px]'));
        editButton.addEventListener('click', () => {
            applySettings(profile);
            showRepositoryForm('接続先を編集');
        });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'icon-btn !h-7 !w-7 text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-dracula-red dark:hover:bg-dracula-current';
        removeButton.title = '削除';
        removeButton.appendChild(createIcon('delete', 'text-[16px]'));
        removeButton.addEventListener('click', () => {
            repositoryProfileStore.remove(profile.id);
            renderRepositoryProfiles();
            if (repositoryProfileStore.getAll().length === 0) resetRepositoryForm();
        });

        actions.appendChild(activeBadge);
        actions.appendChild(editButton);
        actions.appendChild(removeButton);
        top.appendChild(text);
        top.appendChild(actions);
        card.appendChild(top);
        repositoryList.appendChild(card);
    });
}

function showRepositoryLibrary() {
    renderRepositoryProfiles();
    document.getElementById('workspace-view').classList.add('hidden');
    document.getElementById('workspace-view').classList.remove('flex');
    document.getElementById('login-view').classList.remove('hidden');
}

function hideRepositoryLibrary() {
    if (!settings.repo || !settings.token) return;
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('workspace-view').classList.remove('hidden');
    document.getElementById('workspace-view').classList.add('flex');
}

async function openRepository(profile, { preserveUrl = false } = {}) {
    applySettings(profile);
    repositoryProfileStore.setActiveId(profile.id);
    renderRepositoryProfiles();
    localStorage.setItem('github_target_repo', settings.repo);
    localStorage.setItem('github_target_path', settings.path);
    localStorage.setItem('github_pat', settings.token);
    localStorage.setItem(PDF_CACHE_SETTING_KEY, settings.cachePdfBlobs ? 'true' : 'false');
    repositoryIndex.clear();
    clearSearchResults();
    resetViewerState(settings.repo.split('/')[1] || 'Docs Viewer', '');
    if (!preserveUrl) setUrlFilePath(null, { replace: true });

    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('workspace-view').classList.remove('hidden');
    document.getElementById('workspace-view').classList.add('flex');

    treeRoot.innerHTML = '';
    await loadFileTree();
    await openInitialFileIfAvailable();
    toggleSidebar(true);
    schedulePdfCachePrune();
}

function getUrlFilePath() {
    const hashPrefix = '#/file/';
    if (window.location.hash.startsWith(hashPrefix)) {
        return window.location.hash
            .slice(hashPrefix.length)
            .split('/')
            .map(part => decodeURIComponent(part))
            .join('/');
    }

    return new URL(window.location.href).searchParams.get('file');
}

function setUrlFilePath(filePath, { replace = false } = {}) {
    const url = new URL(window.location.href);
    url.searchParams.delete('file');
    url.hash = filePath ? `/file/${filePath.split('/').map(part => encodeURIComponent(part)).join('/')}` : '';

    if (url.href === window.location.href) return;

    const state = filePath ? { filePath } : {};
    if (replace) window.history.replaceState(state, '', url);
    else window.history.pushState(state, '', url);
}

async function findFileByPath(filePath) {
    if (!filePath) return null;
    const { files } = await repositoryIndex.load();
    return files.find(file => file.path === filePath) || null;
}

async function openFile(file, { replaceUrl = false, updateUrl = true } = {}) {
    const type = file.type || fileTypeFromName(file.name);
    const normalizedFile = { ...file, type };

    lastOpenedFileStore.save(settings, normalizedFile, type);
    handleFileClick();
    if (type === 'pdf') await loadPdfContinuous(file.sha, file.name, file.path);
    else await loadMarkdown(file.sha, file.name, file.path);

    if (updateUrl && !isRestoringHistory) setUrlFilePath(file.path, { replace: replaceUrl });
}

async function loadRepositoryIndex() {
    searchStatus.textContent = 'ファイル一覧を取得しています...';
    const index = await repositoryIndex.load();
    if (index.stale) {
        searchStatus.textContent = `${index.files.length}件のファイル (古いキャッシュ)`;
    } else if (index.fromCache) {
        searchStatus.textContent = `${index.files.length}件のファイル (キャッシュ)`;
    } else {
        searchStatus.textContent = index.truncated
            ? 'ファイル一覧が大きいため一部のみ検索します'
            : `${index.files.length}件のファイルを検索できます`;
    }
    return index;
}

function formatSearchSourceLabel(index) {
    if (index?.stale) return ' (古いキャッシュ)';
    if (index?.fromCache) return ' (キャッシュ)';
    return '';
}

function setSearchMode(mode) {
    searchMode = mode;
    document.querySelectorAll('.search-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.searchMode === mode);
    });
    currentSearchBar.classList.toggle('hidden', mode !== 'current');
    if (mode === 'current') {
        currentSearchInput.value = searchInput.value;
        setTimeout(() => currentSearchInput.focus(), 0);
        currentFileSearch.run();
    } else {
        runSearch();
    }
}

function clearSearchResults() {
    searchResults.innerHTML = '';
    searchResults.classList.add('hidden');
    searchStatus.textContent = '';
}

function makeResultPath(file) {
    const rootPath = normalizeRootPath(settings);
    if (!rootPath) return file.path;
    return file.path.replace(new RegExp(`^${rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '');
}

function renderSearchFileResults(files, query, index) {
    searchResults.innerHTML = '';
    searchResults.classList.toggle('hidden', files.length === 0);
    searchStatus.textContent = query ? `${files.length}件のファイル${formatSearchSourceLabel(index)}` : '';

    files.slice(0, 60).forEach(file => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result-row text-gray-700 dark:text-dracula-fg';
        row.title = file.path;
        row.appendChild(createIcon(file.type === 'pdf' ? 'picture_as_pdf' : 'description', `tree-file-icon ${file.type}`));

        const text = document.createElement('div');
        text.className = 'min-w-0';
        const name = document.createElement('div');
        name.className = 'truncate text-sm font-medium';
        name.textContent = file.name;
        const path = document.createElement('div');
        path.className = 'truncate text-[11px] text-gray-500 dark:text-dracula-comment';
        path.textContent = makeResultPath(file);
        text.appendChild(name);
        text.appendChild(path);
        row.appendChild(text);
        row.addEventListener('click', () => openFile(file));
        searchResults.appendChild(row);
    });
}

async function runFileSearch(query) {
    if (!query) {
        clearSearchResults();
        searchStatus.textContent = 'ファイル名やパスを入力して検索';
        return;
    }

    const index = await loadRepositoryIndex();
    const needle = query.toLowerCase();
    renderSearchFileResults(index.files.filter(file => file.path.toLowerCase().includes(needle)), query, index);
}

function renderContentResults(items, query) {
    searchResults.innerHTML = '';
    searchResults.classList.toggle('hidden', items.length === 0);
    searchStatus.textContent = `${items.length}件の本文一致`;

    items.forEach(item => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result-row text-gray-700 dark:text-dracula-fg';
        row.title = item.path;
        row.appendChild(createIcon('description', 'tree-file-icon md'));

        const text = document.createElement('div');
        text.className = 'min-w-0 space-y-0.5';
        const name = document.createElement('div');
        name.className = 'truncate text-sm font-medium';
        name.textContent = item.name;
        const path = document.createElement('div');
        path.className = 'truncate text-[11px] text-gray-500 dark:text-dracula-comment';
        path.textContent = makeResultPath(item);
        const snippet = document.createElement('div');
        snippet.className = 'line-clamp-2 text-xs text-gray-600 dark:text-dracula-comment';
        snippet.textContent = item.fragment || query;
        text.appendChild(name);
        text.appendChild(path);
        text.appendChild(snippet);
        row.appendChild(text);
        row.addEventListener('click', () => openFile(item));
        searchResults.appendChild(row);
    });
}

async function runContentSearch(query) {
    if (!query) {
        clearSearchResults();
        searchStatus.textContent = '検索語を入力するとMarkdown本文を検索します';
        return;
    }

    searchStatus.textContent = 'GitHubで本文検索しています...';
    const rootPath = normalizeRootPath(settings);
    const searchParts = [`${query}`, `repo:${settings.repo}`, 'extension:md'];
    if (rootPath) searchParts.push(`path:${rootPath}`);
    const data = await searchMarkdownCode(settings, searchParts);
    renderContentResults((data.items || []).map(item => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        type: 'md',
        fragment: item.text_matches && item.text_matches[0] ? item.text_matches[0].fragment : ''
    })), query);
}

function runSearch() {
    const query = searchInput.value.trim();
    clearSearchBtn.classList.toggle('hidden', !query);
    if (searchMode === 'current') {
        currentSearchInput.value = query;
        currentFileSearch.run();
        return;
    }

    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(async () => {
        try {
            if (searchMode === 'file') await runFileSearch(query);
            if (searchMode === 'content') await runContentSearch(query);
        } catch (error) {
            searchResults.classList.add('hidden');
            searchStatus.textContent = `検索できませんでした (${error.message})`;
        }
    }, searchMode === 'content' ? 450 : 120);
}

function setActiveTreeItem(item) {
    if (activeTreeItem) activeTreeItem.classList.remove('active');
    item.classList.add('active');
    activeTreeItem = item;
}

async function openInitialFileIfAvailable() {
    const urlFilePath = getUrlFilePath();
    if (urlFilePath) {
        const urlFile = await findFileByPath(urlFilePath);
        if (urlFile) {
            await openFile(urlFile, { replaceUrl: true });
            return;
        }
        setUrlFilePath(null, { replace: true });
    }

    const lastFile = lastOpenedFileStore.get(settings);
    if (!lastFile) return;

    try {
        const indexedLastFile = await findFileByPath(lastFile.path);
        await openFile(indexedLastFile || lastFile, { replaceUrl: true });
    } catch (error) {
        lastOpenedFileStore.clear();
        emptyState.classList.remove('hidden');
    }
}

document.getElementById('menu-btn').addEventListener('click', () => toggleSidebar());
sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
document.getElementById('focus-search-btn').addEventListener('click', () => focusSearch());
document.getElementById('shortcuts-btn').addEventListener('click', () => toggleShortcuts(true));
document.getElementById('close-shortcuts-btn').addEventListener('click', () => toggleShortcuts(false));
cancelLoadingBtn.addEventListener('click', () => loadingController.cancel());
shortcutsModal.addEventListener('click', (event) => {
    if (event.target === shortcutsModal) toggleShortcuts(false);
});
searchInput.addEventListener('input', runSearch);
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchInput.value = '';
    clearSearchResults();
    currentFileSearch.clearMarkdownHighlights();
    runSearch();
    searchInput.focus();
});
document.querySelectorAll('.search-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setSearchMode(btn.dataset.searchMode));
});
newRepositoryBtn.addEventListener('click', resetRepositoryForm);
closeRepositoryLibraryBtn.addEventListener('click', hideRepositoryLibrary);
closeRepositoryFormBtn.addEventListener('click', hideRepositoryForm);
cancelRepositoryFormBtn.addEventListener('click', hideRepositoryForm);
repositoryFormPanel.addEventListener('click', (event) => {
    if (event.target === repositoryFormPanel) hideRepositoryForm();
});
toggleTokenVisibilityBtn.addEventListener('click', () => {
    setTokenVisibility(tokenInput.type === 'password');
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !repositoryFormPanel.classList.contains('hidden')) hideRepositoryForm();
});
currentSearchInput.addEventListener('input', () => currentFileSearch.run());
currentPrevBtn.addEventListener('click', () => currentFileSearch.goToMatch(-1));
currentNextBtn.addEventListener('click', () => currentFileSearch.goToMatch(1));
pdfCacheInput.addEventListener('change', () => {
    settings = { ...settings, cachePdfBlobs: pdfCacheInput.checked };
    localStorage.setItem(PDF_CACHE_SETTING_KEY, settings.cachePdfBlobs ? 'true' : 'false');
    updatePdfCacheHelp();
    schedulePdfCachePrune();
});

function focusSearch(mode = searchMode) {
    toggleSidebar(true);
    setSearchMode(mode);
    setTimeout(() => {
        const target = mode === 'current' ? currentSearchInput : searchInput;
        target.focus();
        target.select();
    }, 0);
}

function toggleShortcuts(forceState) {
    const willOpen = forceState !== undefined ? forceState : shortcutsModal.classList.contains('hidden');
    shortcutsModal.classList.toggle('hidden', !willOpen);
    shortcutsModal.classList.toggle('flex', willOpen);
}

setupKeyboardShortcuts({
    applyTheme: (isDark) => themeController.apply(isDark),
    closeShortcuts: () => toggleShortcuts(false),
    focusSearch,
    isEditableTarget,
    isShortcutsOpen: () => !shortcutsModal.classList.contains('hidden'),
    loadingController,
    toggleShortcuts,
    toggleSidebar,
    updateZoomUI,
    zoomControls,
    zoomState
});

async function init() {
    renderRepositoryProfiles();
    if (!settings.repo || !settings.token) {
        resetRepositoryForm();
        return;
    }

    await openRepository({ ...settings, id: repositoryProfileStore.getActiveId() }, { preserveUrl: true });
}

window.addEventListener('popstate', async () => {
    if (!settings.repo || !settings.token) return;

    const filePath = getUrlFilePath();
    if (!filePath) {
        resetViewerState(settings.repo.split('/')[1] || 'Docs Viewer', '');
        emptyState.classList.remove('hidden');
        return;
    }

    isRestoringHistory = true;
    try {
        const file = await findFileByPath(filePath);
        if (file) await openFile(file, { updateUrl: false });
    } catch (error) {
        alert(`ファイルを開けませんでした (${error.message})`);
    } finally {
        isRestoringHistory = false;
    }
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const displayName = displayNameInput.value.trim();
    const repo = document.getElementById('repo-input').value.trim();
    const path = document.getElementById('path-input').value.trim();
    const token = tokenInput.value.trim();
    const cachePdfBlobs = pdfCacheInput.checked;

    if (!repo || !token) return alert('必須項目を入力してください。');

    const profile = repositoryProfileStore.upsert({ repo, path, token, displayName, cachePdfBlobs });
    hideRepositoryForm();
    await openRepository(profile);
});

async function loadFileTree() {
    const loadingState = loadingController.start();

    try {
        const index = await repositoryIndex.load();
        renderTreeFromFiles(index.files);
    } catch (error) {
        if (loadingState.cancelled || isAbortError(error)) return;
        treeRoot.innerHTML = `<div class="text-red-500 dark:text-dracula-red p-2 text-xs">エラー (${error.message})</div>`;
    } finally {
        loadingController.hide(loadingState);
    }
}

function createTreeNode(name = '') {
    return {
        name,
        folders: new Map(),
        files: []
    };
}

function buildTree(files) {
    const root = createTreeNode();
    const rootPath = normalizeRootPath(settings);
    const rootPrefix = rootPath ? `${rootPath}/` : '';

    files.forEach(file => {
        const relativePath = rootPrefix && file.path.startsWith(rootPrefix)
            ? file.path.slice(rootPrefix.length)
            : file.path;
        const parts = relativePath.split('/').filter(Boolean);
        if (parts.length === 0) return;

        let node = root;
        parts.slice(0, -1).forEach(part => {
            if (!node.folders.has(part)) node.folders.set(part, createTreeNode(part));
            node = node.folders.get(part);
        });
        node.files.push(file);
    });

    return root;
}

function renderTreeFromFiles(files) {
    treeRoot.innerHTML = '';
    const lastOpenedFile = lastOpenedFileStore.get(settings);
    const tree = buildTree(files);
    const ul = renderTreeNode(tree, lastOpenedFile, true);
    treeRoot.appendChild(ul);
}

function renderTreeNode(node, lastOpenedFile, isRoot = false) {
    const ul = document.createElement('ul');
    ul.className = isRoot ? 'tree-list space-y-1' : 'tree-list nested space-y-1';

    if (node.folders.size === 0 && node.files.length === 0) {
        ul.innerHTML = '<li class="text-gray-400 dark:text-dracula-comment text-xs py-1">ファイルなし</li>';
        return ul;
    }

    Array.from(node.folders.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(folder => {
        const li = document.createElement('li');
        const details = document.createElement('details');
        details.className = 'group';
        const summary = document.createElement('summary');
        summary.className = 'tree-row cursor-pointer text-gray-700 dark:text-dracula-fg select-none';
        summary.title = folder.name;

        const chevron = document.createElement('span');
        chevron.className = 'material-symbols-outlined tree-chevron';
        chevron.textContent = 'chevron_right';

        const folderIcon = document.createElement('span');
        folderIcon.className = 'material-symbols-outlined tree-folder-icon';
        folderIcon.textContent = 'folder';

        const folderName = document.createElement('span');
        folderName.className = 'truncate';
        folderName.textContent = folder.name;

        summary.appendChild(chevron);
        summary.appendChild(folderIcon);
        summary.appendChild(folderName);

        const childrenContainer = document.createElement('div');
        details.addEventListener('toggle', () => {
            folderIcon.textContent = details.open ? 'folder_open' : 'folder';
        });
        details.appendChild(summary);
        childrenContainer.appendChild(renderTreeNode(folder, lastOpenedFile));
        details.appendChild(childrenContainer);
        li.appendChild(details);
        ul.appendChild(li);
    });

    node.files
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(file => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const li = document.createElement('li');
        li.className = 'tree-row cursor-pointer text-blue-600 dark:text-dracula-cyan';
        li.dataset.path = file.path;
        li.title = file.name;

        const spacer = document.createElement('span');
        spacer.className = 'w-[18px] shrink-0';

        const fileIcon = document.createElement('span');
        fileIcon.className = `material-symbols-outlined tree-file-icon ${isPdf ? 'pdf' : 'md'}`;
        fileIcon.textContent = isPdf ? 'picture_as_pdf' : 'description';

        const fileName = document.createElement('span');
        fileName.className = 'truncate';
        fileName.textContent = file.name;

        li.appendChild(spacer);
        li.appendChild(fileIcon);
        li.appendChild(fileName);
        if ((currentFile && currentFile.path === file.path) || (lastOpenedFile && lastOpenedFile.path === file.path)) setActiveTreeItem(li);
        li.addEventListener('click', () => {
            setActiveTreeItem(li);
            openFile({ ...file, type: isPdf ? 'pdf' : 'md' });
        });
        ul.appendChild(li);
    });
    return ul;
}

function decodeBase64UTF8(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
}

function decodeBase64Bytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
}

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
    return `${Math.round(bytes / 1024)}KB`;
}

async function updatePdfCacheHelp() {
    if (!pdfCacheHelp) return;
    const mobileNote = pdfBlobCache.getMaxBytes() === MOBILE_MAX_BYTES ? 'スマホ上限' : 'PC上限';
    if (!settings.cachePdfBlobs) {
        pdfCacheHelp.textContent = 'OFF推奨。ONの場合、PCは最大100MB、スマホは最大40MBまで保存し、古いPDFから自動削除します。';
        return;
    }

    const usage = await pdfBlobCache.getUsage();
    pdfCacheHelp.textContent = `${mobileNote} ${formatBytes(usage.maxBytes)} / 使用中 ${formatBytes(usage.bytes)} (${usage.count}件)。古いPDFから自動削除します。`;
}

function schedulePdfCachePrune() {
    if (!settings.cachePdfBlobs) return;
    const prune = () => pdfBlobCache.prune().then(updatePdfCacheHelp).catch(() => {});
    if ('requestIdleCallback' in window) window.requestIdleCallback(prune, { timeout: 3000 });
    else window.setTimeout(prune, 1000);
}

async function loadPdfBytes(fileSha, fileName, filePath, signal) {
    const file = { sha: fileSha, name: fileName, path: filePath };
    if (settings.cachePdfBlobs) {
        const cachedBytes = await pdfBlobCache.get(settings, file);
        if (cachedBytes) return cachedBytes;
    }

    const data = await fetchBlob(settings, fileSha, { signal });
    const bytes = decodeBase64Bytes(data.content);
    if (settings.cachePdfBlobs) {
        await pdfBlobCache.put(settings, file, bytes);
        updatePdfCacheHelp();
    }
    return bytes;
}

async function loadMarkdown(fileSha, fileName, filePath = fileName) {
    const loadingState = loadingController.start();
    resetViewerState(fileName, 'md');
    currentFile = { sha: fileSha, name: fileName, path: filePath, type: 'md' };

    try {
        const data = await fetchBlob(settings, fileSha, { signal: loadingState.controller.signal });

        const markdownText = decodeBase64UTF8(data.content);
        const rawHtml = md.render(markdownText);

        const cleanHtml = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['math', 'maction', 'maligngroup', 'malignmark', 'menclose', 'merror', 'mfenced', 'mfrac', 'mi', 'mlongdiv', 'mmultiscripts', 'mn', 'mo', 'mover', 'mpadded', 'mphantom', 'mroot', 'mrow', 'ms', 'mscarries', 'mscarry', 'msgroup', 'msline', 'mspace', 'msqrt', 'msrow', 'mstyle', 'msub', 'msup', 'msubsup', 'mtable', 'mtd', 'mtext', 'mtr', 'munder', 'munderover', 'semantics', 'annotation', 'annotation-xml'],
            ADD_ATTRS: ['target', 'class', 'style', 'xmlns', 'display', 'type', 'checked', 'disabled']
        });

        mdWrapper.innerHTML = cleanHtml;
        mdWrapper.classList.remove('hidden');
        if (currentSearchInput.value.trim()) currentFileSearch.run();

    } catch (error) {
        if (loadingState.cancelled || isAbortError(error)) {
            emptyState.classList.remove('hidden');
            return;
        }
        alert('Markdownの読み込みに失敗しました。');
        emptyState.classList.remove('hidden');
    } finally {
        loadingController.hide(loadingState);
    }
}

function updateZoomUI() {
    zoomLevelText.textContent = `${zoomState.current}%`;
    const targetWidth = (getPdfBaseWidth() * (zoomState.current / 100));
    if (isDesktopLayout()) {
        pdfWrapper.style.maxWidth = 'none';
        pdfWrapper.style.width = `${targetWidth}px`;
    } else {
        pdfWrapper.style.maxWidth = `${targetWidth}px`;
        pdfWrapper.style.width = `${zoomState.current}%`;
    }
}

document.getElementById('zoom-in-btn').addEventListener('click', () => {
    if (zoomState.current < 300) { zoomState.current += 25; updateZoomUI(); }
});
document.getElementById('zoom-out-btn').addEventListener('click', () => {
    if (zoomState.current > 50) { zoomState.current -= 25; updateZoomUI(); }
});
zoomLevelText.addEventListener('click', () => { zoomState.current = 100; updateZoomUI(); });

async function loadPdfContinuous(fileSha, fileName, filePath = fileName) {
    const loadingState = loadingController.start();
    resetViewerState(fileName, 'pdf');
    currentFile = { sha: fileSha, name: fileName, path: filePath, type: 'pdf' };

    try {
        const bytes = await loadPdfBytes(fileSha, fileName, filePath, loadingState.controller.signal);
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        loadingState.pdfTask = loadingTask;
        pdfDoc = await loadingTask.promise;
        loadingState.pdfTask = null;
        currentFileSearch.reset();

        pdfWrapper.classList.remove('hidden');
        await setupContinuousScroll();
        if (currentSearchInput.value.trim()) currentFileSearch.run();
    } catch (error) {
        if (loadingState.cancelled || isAbortError(error)) {
            emptyState.classList.remove('hidden');
            return;
        }
        alert('PDFの読み込みに失敗しました。');
        emptyState.classList.remove('hidden');
    } finally {
        loadingController.hide(loadingState);
    }
}

async function setupContinuousScroll() {
    const numPages = pdfDoc.numPages;
    const firstPage = await pdfDoc.getPage(1);
    const vp = firstPage.getViewport({ scale: 1 });
    const aspectRatioCSS = `${vp.width} / ${vp.height}`;

    pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.rendered) {
                entry.target.dataset.rendered = 'true';
                renderSinglePage(Number(entry.target.dataset.page), entry.target);
            }
        });
    }, { root: scrollContainer, rootMargin: '150% 0px' });

    for (let i = 1; i <= numPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'w-full bg-white shadow-sm dark:shadow-md relative flex justify-center items-center overflow-hidden rounded border border-gray-200 dark:border-dracula-current transition-colors';
        wrapper.style.aspectRatio = aspectRatioCSS;
        wrapper.dataset.page = i;

        const watermark = document.createElement('span');
        watermark.className = 'text-gray-300 dark:text-gray-600 font-bold text-4xl absolute z-0';
        watermark.textContent = i;

        wrapper.appendChild(watermark);
        pdfWrapper.appendChild(wrapper);
        pageObserver.observe(wrapper);
    }
}

async function renderSinglePage(pageNum, wrapperNode) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        const pixelRatio = window.devicePixelRatio || 1;
        const displayWidth = wrapperNode.clientWidth > 0 ? wrapperNode.clientWidth : getPdfBaseWidth();
        const originalViewport = page.getViewport({ scale: 1 });
        const baseScale = displayWidth / originalViewport.width;

        const renderViewport = page.getViewport({ scale: baseScale * pixelRatio });

        const canvas = document.createElement('canvas');
        canvas.className = 'absolute inset-0 w-full h-full object-contain z-10';
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

        wrapperNode.innerHTML = '';
        wrapperNode.appendChild(canvas);
    } catch (error) {
        console.error(`Page ${pageNum} render error:`, error);
    }
}

function resetViewerState(fileName, type) {
    document.getElementById('header-title').textContent = fileName;
    emptyState.classList.add('hidden');
    pdfWrapper.classList.add('hidden');
    mdWrapper.classList.add('hidden');
    currentFileSearch.reset();
    currentFile = null;

    if (type === 'pdf') {
        zoomControls.classList.remove('hidden');
        zoomState.current = 100;
        updateZoomUI();
    } else {
        zoomControls.classList.add('hidden');
    }

    if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null; }
    if (pageObserver) { pageObserver.disconnect(); pageObserver = null; }
    pdfWrapper.innerHTML = '';
    mdWrapper.innerHTML = '';
    scrollContainer.scrollTop = 0;
}

window.addEventListener('resize', () => {
    if (!pdfWrapper.classList.contains('hidden')) updateZoomUI();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    showRepositoryLibrary();
    toggleSidebar(false);
});

export function initDocsViewerApp() {
    init();
}
