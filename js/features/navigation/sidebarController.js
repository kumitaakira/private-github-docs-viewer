export class SidebarController {
    /**
     * @param {{ sidebar: HTMLElement, overlay: HTMLElement }} options
     */
    constructor({ sidebar, overlay }) {
        this.sidebar = sidebar;
        this.overlay = overlay;
    }

    /**
     * Toggle the sidebar, or force it open/closed.
     *
     * @param {boolean} [forceState]
     */
    toggle(forceState) {
        const isOpen = !this.sidebar.classList.contains('-translate-x-full');
        const willOpen = forceState !== undefined ? forceState : !isOpen;

        if (willOpen) {
            this.sidebar.classList.remove('-translate-x-full');
            this.overlay.classList.remove('hidden');
        } else {
            this.sidebar.classList.add('-translate-x-full');
            this.overlay.classList.add('hidden');
        }
    }

    /**
     * Close the sidebar after file selection on narrow screens.
     */
    closeOnMobile() {
        if (window.innerWidth < 768) this.toggle(false);
    }
}
