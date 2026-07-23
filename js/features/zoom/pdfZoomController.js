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
        this.gestureAnchor = null;
        this.touchGesture = null;
        this.nativeGestureActive = false;
        this.boundHandleWheel = (event) => this.handleWheel(event);
        this.boundHandleKeyDown = (event) => this.handleKeyDown(event);
        this.boundHandleGestureStart = (event) => this.handleGestureStart(event);
        this.boundHandleGestureChange = (event) => this.handleGestureChange(event);
        this.boundResetGestureScale = () => this.resetGesture();
        this.boundHandleTouchStart = (event) => this.handleTouchStart(event);
        this.boundHandleTouchMove = (event) => this.handleTouchMove(event);
        this.boundHandleTouchEnd = (event) => this.handleTouchEnd(event);
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
        this.scrollContainer.addEventListener('touchstart', this.boundHandleTouchStart, blockingOptions);
        this.scrollContainer.addEventListener('touchmove', this.boundHandleTouchMove, blockingOptions);
        this.scrollContainer.addEventListener('touchend', this.boundHandleTouchEnd, blockingOptions);
        this.scrollContainer.addEventListener('touchcancel', this.boundHandleTouchEnd, blockingOptions);
        document.addEventListener('keydown', this.boundHandleKeyDown, blockingOptions);
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
        this.changeZoom(direction * 10, this.getEventPoint(event));
    }

    /**
     * Convert browser zoom shortcuts into PDF viewer zoom while a PDF is open.
     *
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (!this.isPdfVisible()) return;
        if (!event.ctrlKey && !event.metaKey) return;

        if (['+', '=', '-'].includes(event.key)) {
            this.cancelGestureEvent(event);
            this.changeZoom(event.key === '-' ? -25 : 25);
            return;
        }

        if (event.key === '0') {
            this.cancelGestureEvent(event);
            this.setZoom(100);
        }
    }

    /**
     * Prevent Safari's page-level pinch zoom while a PDF is open.
     *
     * @param {Event} event
     */
    handleGestureStart(event) {
        if (!this.isPdfVisible()) return;
        this.cancelGestureEvent(event);
        this.nativeGestureActive = true;
        this.touchGesture = null;
        this.lastGestureScale = 1;
        const point = this.getEventPoint(event);
        this.gestureAnchor = this.captureZoomAnchor(point);
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
        this.changeZoom(scaleDiff > 0 ? 10 : -10, this.getEventPoint(event), this.gestureAnchor);
    }

    /**
     * Start a native two-finger pinch. Safari emits gesture* events, while
     * Chromium on mobile exposes the same interaction through touch events.
     *
     * @param {TouchEvent} event
     */
    handleTouchStart(event) {
        if (this.nativeGestureActive || !this.isPdfVisible() || event.touches.length !== 2) return;
        this.cancelGestureEvent(event);

        const point = this.getTouchCenter(event.touches);
        this.touchGesture = {
            initialDistance: this.getTouchDistance(event.touches),
            initialZoom: this.zoomState.current,
            anchor: this.captureZoomAnchor(point)
        };
    }

    /**
     * Zoom around the midpoint of the two fingers. Keeping the anchor captured
     * at touchstart also makes translating both fingers pan the document.
     *
     * @param {TouchEvent} event
     */
    handleTouchMove(event) {
        if (this.nativeGestureActive || !this.touchGesture || event.touches.length !== 2) return;
        this.cancelGestureEvent(event);

        const distance = this.getTouchDistance(event.touches);
        if (!this.touchGesture.initialDistance || !distance) return;

        const nextZoom = Math.round(
            this.touchGesture.initialZoom * (distance / this.touchGesture.initialDistance)
        );
        this.setZoom(nextZoom, this.getTouchCenter(event.touches), this.touchGesture.anchor);
    }

    /**
     * @param {TouchEvent} event
     */
    handleTouchEnd(event) {
        if (!this.touchGesture) return;
        if (event.touches.length < 2) this.touchGesture = null;
    }

    resetGesture() {
        this.lastGestureScale = 1;
        this.gestureAnchor = null;
        this.nativeGestureActive = false;
    }

    /**
     * @param {Event & { clientX?: number, clientY?: number }} event
     * @returns {{ clientX: number, clientY: number }}
     */
    getEventPoint(event) {
        if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            const rect = this.scrollContainer.getBoundingClientRect();
            const isInsideViewer = event.clientX >= rect.left
                && event.clientX <= rect.left + rect.width
                && event.clientY >= rect.top
                && event.clientY <= rect.top + rect.height;
            if (isInsideViewer) {
                return { clientX: event.clientX, clientY: event.clientY };
            }
        }
        return this.getViewportCenter();
    }

    /**
     * @param {TouchList} touches
     * @returns {{ clientX: number, clientY: number }}
     */
    getTouchCenter(touches) {
        return {
            clientX: (touches[0].clientX + touches[1].clientX) / 2,
            clientY: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    /**
     * @param {TouchList} touches
     * @returns {number}
     */
    getTouchDistance(touches) {
        return Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
        );
    }

    /**
     * @returns {{ clientX: number, clientY: number }}
     */
    getViewportCenter() {
        const rect = this.scrollContainer.getBoundingClientRect();
        return {
            clientX: rect.left + (rect.width / 2),
            clientY: rect.top + (rect.height / 2)
        };
    }

    /**
     * Store a PDF-local point so it can be put back under the cursor after the
     * wrapper changes size. A page is preferred over the whole wrapper because
     * fixed page gaps and padding do not scale with the PDF.
     *
     * @param {{ clientX: number, clientY: number }} point
     * @returns {{ element: HTMLElement, xRatio: number, yRatio: number }}
     */
    captureZoomAnchor(point) {
        const hit = document.elementFromPoint?.(point.clientX, point.clientY);
        const page = hit?.closest?.('[data-page]');
        const element = page && this.pdfWrapper.contains(page) ? page : this.pdfWrapper;
        const rect = element.getBoundingClientRect();

        return {
            element,
            xRatio: rect.width ? (point.clientX - rect.left) / rect.width : 0.5,
            yRatio: rect.height ? (point.clientY - rect.top) / rect.height : 0.5
        };
    }

    /**
     * @param {{ element: HTMLElement, xRatio: number, yRatio: number }} anchor
     * @param {{ clientX: number, clientY: number }} point
     */
    restoreZoomAnchor(anchor, point) {
        if (!anchor?.element?.isConnected) return;
        const rect = anchor.element.getBoundingClientRect();
        const anchoredX = rect.left + (rect.width * anchor.xRatio);
        const anchoredY = rect.top + (rect.height * anchor.yRatio);

        this.scrollContainer.scrollLeft += anchoredX - point.clientX;
        this.scrollContainer.scrollTop += anchoredY - point.clientY;
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
    changeZoom(delta, point = this.getViewportCenter(), anchor = null) {
        this.setZoom(this.zoomState.current + delta, point, anchor);
    }

    /**
     * @param {number} requestedZoom
     * @param {{ clientX: number, clientY: number }} [point]
     * @param {{ element: HTMLElement, xRatio: number, yRatio: number }} [anchor]
     */
    setZoom(requestedZoom, point = this.getViewportCenter(), anchor = null) {
        const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, requestedZoom));
        const zoomAnchor = anchor || this.captureZoomAnchor(point);
        if (nextZoom === this.zoomState.current) {
            if (anchor) this.restoreZoomAnchor(zoomAnchor, point);
            return;
        }

        this.zoomState.current = nextZoom;
        this.updateZoomUI();
        this.restoreZoomAnchor(zoomAnchor, point);
    }
}
