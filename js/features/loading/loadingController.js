export class LoadingController {
    /**
     * @param {{ overlay: HTMLElement }} options
     */
    constructor({ overlay }) {
        this.overlay = overlay;
        this.active = null;
        this.sequence = 0;
    }

    /**
     * Start a cancellable loading session. Starting a new session cancels the old one.
     *
     * @returns {{ controller: AbortController, id: number, cancelled: boolean, pdfTask: any }}
     */
    start() {
        this.cancel();
        const state = {
            controller: new AbortController(),
            id: ++this.sequence,
            cancelled: false,
            pdfTask: null
        };
        this.active = state;
        this.overlay.classList.remove('hidden');
        return state;
    }

    /**
     * Hide the overlay only if the provided session is still the active one.
     *
     * @param {{ controller: AbortController, id: number, cancelled: boolean, pdfTask: any } | null} [state]
     */
    hide(state = this.active) {
        if (!state || this.active !== state) return;
        this.active = null;
        this.overlay.classList.add('hidden');
    }

    /**
     * Cancel the active loading session, including a PDF.js loading task when present.
     */
    cancel() {
        if (!this.active) return;
        const state = this.active;
        this.active = null;
        state.cancelled = true;
        state.controller.abort();
        if (state.pdfTask) state.pdfTask.destroy();
        this.overlay.classList.add('hidden');
    }

    /**
     * @returns {boolean}
     */
    get isActive() {
        return Boolean(this.active);
    }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAbortError(error) {
    return error && (error.name === 'AbortError' || error.message === 'AbortError');
}
