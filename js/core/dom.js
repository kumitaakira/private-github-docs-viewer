/**
 * Collect DOM elements used by the app shell.
 *
 * @returns {Object<string, HTMLElement>}
 */
export function getDomElements() {
    return {
        treeRoot: document.getElementById('tree-root'),
        scrollContainer: document.getElementById('scroll-container'),
        emptyState: document.getElementById('empty-state'),
        pdfWrapper: document.getElementById('pdf-wrapper'),
        mdWrapper: document.getElementById('md-wrapper'),
        zoomControls: document.getElementById('zoom-controls'),
        zoomLevelText: document.getElementById('zoom-level'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        themeToggleIcon: document.getElementById('theme-toggle-icon'),
        mdStyle: document.getElementById('md-style'),
        hlStyle: document.getElementById('hl-style'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        searchStatus: document.getElementById('search-status'),
        searchResults: document.getElementById('search-results'),
        currentSearchBar: document.getElementById('current-search-bar'),
        currentSearchInput: document.getElementById('current-search-input'),
        currentSearchCount: document.getElementById('current-search-count'),
        currentPrevBtn: document.getElementById('current-prev-btn'),
        currentNextBtn: document.getElementById('current-next-btn'),
        shortcutsModal: document.getElementById('shortcuts-modal'),
        loading: document.getElementById('loading'),
        cancelLoadingBtn: document.getElementById('cancel-loading-btn')
    };
}
