import { fetchBlob, fetchContents, searchMarkdownCode } from '../../api/github.js';
import { getDomElements } from '../../core/dom.js';
import { createMarkdownRenderer } from '../../markdown/renderer.js';
import { LoadingController, isAbortError } from '../loading/loadingController.js';
import { SidebarController } from '../navigation/sidebarController.js';
import { fileTypeFromName, normalizeRootPath, RepositoryIndex } from '../repository/repositoryIndex.js';
import { CurrentFileSearchController } from '../search/currentFileSearch.js';
import { setupKeyboardShortcuts } from '../shortcuts/keyboardShortcuts.js';
import { LastOpenedFileStore } from '../storage/lastOpenedFile.js';
import { ThemeController } from '../theme/themeController.js';
import { PdfZoomController } from '../zoom/pdfZoomController.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const md = createMarkdownRenderer();

let settings = {
    repo: localStorage.getItem('github_target_repo') || '',
    path: localStorage.getItem('github_target_path') || '',
    token: localStorage.getItem('github_pat') || ''
};
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
currentSearchInput.addEventListener('input', () => currentFileSearch.run());
currentPrevBtn.addEventListener('click', () => currentFileSearch.goToMatch(-1));
currentNextBtn.addEventListener('click', () => currentFileSearch.goToMatch(1));

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
    document.getElementById('repo-input').value = settings.repo;
    document.getElementById('path-input').value = settings.path;
    document.getElementById('token-input').value = settings.token;

    if (settings.repo && settings.token) {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('workspace-view').classList.remove('hidden');
        document.getElementById('workspace-view').classList.add('flex');
        document.getElementById('header-title').textContent = settings.repo.split('/')[1] || 'Docs Viewer';
        await loadTreeLevel(settings.path, treeRoot);
        await openInitialFileIfAvailable();
    }
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
    const repo = document.getElementById('repo-input').value.trim();
    const path = document.getElementById('path-input').value.trim();
    const token = document.getElementById('token-input').value.trim();

    if (!repo || !token) return alert('必須項目を入力してください。');

    settings = { repo, path, token };
    localStorage.setItem('github_target_repo', repo);
    localStorage.setItem('github_target_path', path);
    localStorage.setItem('github_pat', token);
    repositoryIndex.clear();
    clearSearchResults();

    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('workspace-view').classList.remove('hidden');
    document.getElementById('workspace-view').classList.add('flex');

    treeRoot.innerHTML = '';
    await loadTreeLevel(settings.path, treeRoot);
    await openInitialFileIfAvailable();
    toggleSidebar(true);
});

async function loadTreeLevel(path, container) {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const loadingState = container === treeRoot ? loadingController.start() : null;

    try {
        const data = await fetchContents(settings, cleanPath, { signal: loadingState?.controller.signal });
        const items = Array.isArray(data) ? data : [data];

        const folders = items.filter(i => i.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
        const files = items.filter(i => i.type === 'file' && (i.name.toLowerCase().endsWith('.pdf') || i.name.toLowerCase().endsWith('.md'))).sort((a, b) => a.name.localeCompare(b.name));

        renderTreeItems(folders, files, container);
    } catch (error) {
        if (loadingState?.cancelled || isAbortError(error)) return;
        container.innerHTML = `<div class="text-red-500 dark:text-dracula-red p-2 text-xs">エラー (${error.message})</div>`;
    } finally {
        if (loadingState) loadingController.hide(loadingState);
    }
}

function renderTreeItems(folders, files, container) {
    container.innerHTML = '';
    const lastOpenedFile = lastOpenedFileStore.get(settings);
    const ul = document.createElement('ul');
    ul.className = container === treeRoot ? 'tree-list space-y-1' : 'tree-list nested space-y-1';

    if (folders.length === 0 && files.length === 0) {
        ul.innerHTML = '<li class="text-gray-400 dark:text-dracula-comment text-xs py-1">ファイルなし</li>';
        container.appendChild(ul);
        return;
    }

    folders.forEach(folder => {
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
            if (details.open && !details.dataset.loaded) {
                details.dataset.loaded = 'true';
                childrenContainer.innerHTML = '<div class="pl-4 py-1 text-gray-400 dark:text-dracula-comment text-xs animate-pulse">読込中...</div>';
                loadTreeLevel(folder.path, childrenContainer);
            }
        });
        details.appendChild(summary);
        details.appendChild(childrenContainer);
        li.appendChild(details);
        ul.appendChild(li);
    });

    files.forEach(file => {
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
    container.appendChild(ul);
}

function decodeBase64UTF8(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
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
    pdfWrapper.style.maxWidth = `${targetWidth}px`;
    pdfWrapper.style.width = `${zoomState.current}%`;
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
        const data = await fetchBlob(settings, fileSha, { signal: loadingState.controller.signal });

        const binaryString = atob(data.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

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
    document.getElementById('workspace-view').classList.add('hidden');
    document.getElementById('workspace-view').classList.remove('flex');
    document.getElementById('login-view').classList.remove('hidden');
    resetViewerState('Docs Viewer', '');
    emptyState.classList.remove('hidden');
    toggleSidebar(false);
});

export function initDocsViewerApp() {
    init();
}
