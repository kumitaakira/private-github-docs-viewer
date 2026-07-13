export class PdfZoomController {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.scrollContainer
     * @param {HTMLElement} options.pdfWrapper
     * @param {{ current: number }} options.zoomState
     * @param {() => void} options.updateZoomUI
     * @param {number} [options.minZoom]
     * @param {number} [options.maxZoom]
     */
    constructor({ scrollContainer, pdfWrapper, zoomState, updateZoomUI, minZoom = 50, maxZoom = 300 }) {
        this.scrollContainer = scrollContainer;
        this.pdfWrapper = pdfWrapper;
        this.zoomState = zoomState;
        this.updateZoomUI = updateZoomUI;
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        this.wheelDelta = 0;
        this.lastGestureScale = 1;
        this.boundHandleWheel = (event) => this.handleWheel(event);
        this.boundHandleGestureStart = (event) => this.handleGestureStart(event);
        this.boundHandleGestureChange = (event) => this.handleGestureChange(event);
        this.boundResetGestureScale = () => { this.lastGestureScale = 1; };
    }

    /**
     * Register pointer/trackpad zoom handlers.
     *
     * Trackpad pinch is exposed as ctrl+wheel in Chromium-based browsers and
     * as gesture* events in Safari. Some browser/OS zoom shortcuts are not
     * cancelable from JavaScript, but these handlers cover the web-viewer cases.
     */
    attach() {
        const blockingOptions = { capture: true, passive: false };
        this.getGestureTargets().forEach((target) => {
            target.addEventListener('wheel', this.boundHandleWheel, blockingOptions);
            target.addEventListener('mousewheel', this.boundHandleWheel, blockingOptions);
            target.addEventListener('gesturestart', this.boundHandleGestureStart, blockingOptions);
            target.addEventListener('gesturechange', this.boundHandleGestureChange, blockingOptions);
            target.addEventListener('gestureend', this.boundResetGestureScale, { capture: true, passive: true });
        });
    }

    /**
     * @returns {EventTarget[]}
     */
    getGestureTargets() {
        return [window, document, document.documentElement, document.body, this.scrollContainer, this.pdfWrapper]
            .filter(Boolean);
    }

    /**
     * @returns {boolean}
     */
    isPdfVisible() {
        return !this.pdfWrapper.classList.contains('hidden');
    }

    /**
     * Convert browser zoom wheel gestures into PDF viewer zoom.
     *
     * @param {WheelEvent} event
     */
    handleWheel(event) {
        if (!this.isPdfVisible()) return;
        if (!event.ctrlKey && !event.metaKey) return;

        this.cancelGestureEvent(event);

        const deltaY = Number.isFinite(event.deltaY) ? event.deltaY : -(event.wheelDelta || 0);
        this.wheelDelta += deltaY;
        if (Math.abs(this.wheelDelta) < 8) return;

        const direction = this.wheelDelta < 0 ? 1 : -1;
        this.wheelDelta = 0;
        this.changeZoom(direction * 10);
    }

    /**
     * Prevent Safari's page-level pinch zoom while a PDF is open.
     *
     * @param {Event} event
     */
    handleGestureStart(event) {
        if (!this.isPdfVisible()) return;
        this.cancelGestureEvent(event);
        this.lastGestureScale = 1;
    }

    /**
     * Convert Safari gesture scale changes into PDF viewer zoom steps.
     *
     * @param {Event & { scale?: number }} event
     */
    handleGestureChange(event) {
        if (!this.isPdfVisible()) return;
        this.cancelGestureEvent(event);

        const scale = event.scale || 1;
        const scaleDiff = scale - this.lastGestureScale;
        if (Math.abs(scaleDiff) < 0.08) return;

        this.lastGestureScale = scale;
        this.changeZoom(scaleDiff > 0 ? 10 : -10);
    }

    /**
     * @param {Event} event
     */
    cancelGestureEvent(event) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    /**
     * @param {number} delta
     */
    changeZoom(delta) {
        const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomState.current + delta));
        if (nextZoom === this.zoomState.current) return;
        this.zoomState.current = nextZoom;
        this.updateZoomUI();
    }
}
