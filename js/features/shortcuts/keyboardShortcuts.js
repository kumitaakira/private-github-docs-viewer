/**
 * Register global keyboard shortcuts for navigation, search, theme, zoom, and cancel.
 *
 * @param {Object} options
 * @param {(isDark: boolean) => void} options.applyTheme
 * @param {() => void} options.closeShortcuts
 * @param {(mode?: string) => void} options.focusSearch
 * @param {(target: EventTarget | null) => boolean} options.isEditableTarget
 * @param {() => boolean} options.isShortcutsOpen
 * @param {import('../loading/loadingController.js').LoadingController} options.loadingController
 * @param {(forceState?: boolean) => void} options.toggleShortcuts
 * @param {(forceState?: boolean) => void} options.toggleSidebar
 * @param {() => void} options.updateZoomUI
 * @param {HTMLElement} options.zoomControls
 * @param {{ current: number }} options.zoomState
 */
export function setupKeyboardShortcuts({
    applyTheme,
    closeShortcuts,
    focusSearch,
    isEditableTarget,
    isShortcutsOpen,
    loadingController,
    toggleShortcuts,
    toggleSidebar,
    updateZoomUI,
    zoomControls,
    zoomState
}) {
    document.addEventListener('keydown', (event) => {
        const commandKey = event.metaKey || event.ctrlKey;

        if (commandKey && event.key === '/') {
            event.preventDefault();
            toggleShortcuts();
            return;
        }
        if (commandKey && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            focusSearch('file');
            return;
        }
        if (commandKey && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            focusSearch('current');
            return;
        }
        if (commandKey && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            toggleSidebar();
            return;
        }
        if (commandKey && event.shiftKey && event.key.toLowerCase() === 'l') {
            event.preventDefault();
            applyTheme(!document.documentElement.classList.contains('dark'));
            return;
        }
        if (commandKey && (event.key === '+' || event.key === '=')) {
            if (!zoomControls.classList.contains('hidden')) {
                event.preventDefault();
                if (zoomState.current < 300) {
                    zoomState.current += 25;
                    updateZoomUI();
                }
            }
            return;
        }
        if (commandKey && event.key === '-') {
            if (!zoomControls.classList.contains('hidden')) {
                event.preventDefault();
                if (zoomState.current > 50) {
                    zoomState.current -= 25;
                    updateZoomUI();
                }
            }
            return;
        }
        if (event.key === 'Escape') {
            if (loadingController.isActive) {
                loadingController.cancel();
                return;
            }
            if (isShortcutsOpen()) {
                closeShortcuts();
                return;
            }
            if (!isEditableTarget(event.target)) toggleSidebar(false);
            if (isEditableTarget(event.target)) event.target.blur();
        }
    });
}
