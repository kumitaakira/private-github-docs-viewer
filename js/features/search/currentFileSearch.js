function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class CurrentFileSearchController {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.mdWrapper
     * @param {HTMLElement} options.pdfWrapper
     * @param {HTMLElement} options.currentSearchBar
     * @param {HTMLInputElement} options.currentSearchInput
     * @param {HTMLElement} options.currentSearchCount
     * @param {HTMLButtonElement} options.currentPrevBtn
     * @param {HTMLButtonElement} options.currentNextBtn
     * @param {HTMLInputElement} options.searchInput
     * @param {HTMLButtonElement} options.clearSearchBtn
     * @param {() => import('../../core/types.js').ViewerFile | null} options.getCurrentFile
     * @param {() => any} options.getPdfDoc
     */
    constructor({ mdWrapper, pdfWrapper, currentSearchBar, currentSearchInput, currentSearchCount, currentPrevBtn, currentNextBtn, searchInput, clearSearchBtn, getCurrentFile, getPdfDoc }) {
        this.mdWrapper = mdWrapper;
        this.pdfWrapper = pdfWrapper;
        this.currentSearchBar = currentSearchBar;
        this.currentSearchInput = currentSearchInput;
        this.currentSearchCount = currentSearchCount;
        this.currentPrevBtn = currentPrevBtn;
        this.currentNextBtn = currentNextBtn;
        this.searchInput = searchInput;
        this.clearSearchBtn = clearSearchBtn;
        this.getCurrentFile = getCurrentFile;
        this.getPdfDoc = getPdfDoc;
        this.matches = [];
        this.matchIndex = -1;
        this.pdfPageTexts = new Map();
    }

    /**
     * Remove Markdown search highlight marks without changing the underlying text.
     */
    clearMarkdownHighlights() {
        this.mdWrapper.querySelectorAll('mark.search-highlight').forEach(mark => {
            const text = document.createTextNode(mark.textContent);
            mark.replaceWith(text);
        });
        this.mdWrapper.normalize();
    }

    /**
     * Reset search state and, optionally, cached PDF page text.
     *
     * @param {{ clearPdfText?: boolean }} [options]
     */
    reset({ clearPdfText = true } = {}) {
        this.clearMarkdownHighlights();
        this.matches = [];
        this.matchIndex = -1;
        if (clearPdfText) this.pdfPageTexts = new Map();
        this.updateUI();
    }

    /**
     * Highlight all text matches in the rendered Markdown document.
     *
     * @param {string} query
     */
    highlightMarkdownMatches(query) {
        this.clearMarkdownHighlights();
        this.matches = [];
        this.matchIndex = -1;
        if (!query || this.mdWrapper.classList.contains('hidden')) return;

        const matcher = new RegExp(escapeRegExp(query), 'gi');
        const walker = document.createTreeWalker(this.mdWrapper, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                if (node.parentElement.closest('script, style, mark')) return NodeFilter.FILTER_REJECT;
                matcher.lastIndex = 0;
                return matcher.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            matcher.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            node.nodeValue.replace(matcher, (match, offset) => {
                fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = match;
                this.matches.push(mark);
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
            node.replaceWith(fragment);
        });
    }

    /**
     * Extract and cache text for every PDF page.
     *
     * @returns {Promise<void>}
     */
    async ensurePdfPageTexts() {
        const pdfDoc = this.getPdfDoc();
        if (!pdfDoc || this.pdfPageTexts.size === pdfDoc.numPages) return;
        this.currentSearchCount.textContent = '抽出中';
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            if (this.pdfPageTexts.has(pageNum)) continue;
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            this.pdfPageTexts.set(pageNum, textContent.items.map(item => item.str).join(' '));
        }
    }

    /**
     * Search cached PDF page text and store page-level matches.
     *
     * @param {string} query
     * @returns {Promise<void>}
     */
    async searchPdf(query) {
        this.matches = [];
        this.matchIndex = -1;
        const pdfDoc = this.getPdfDoc();
        if (!query || !pdfDoc) return;

        await this.ensurePdfPageTexts();
        const needle = query.toLowerCase();
        this.pdfPageTexts.forEach((text, pageNum) => {
            let index = text.toLowerCase().indexOf(needle);
            while (index !== -1) {
                this.matches.push({ pageNum });
                index = text.toLowerCase().indexOf(needle, index + needle.length);
            }
        });
    }

    /**
     * Update result count and prev/next disabled state.
     */
    updateUI() {
        const total = this.matches.length;
        this.currentSearchCount.textContent = total ? `${this.matchIndex + 1}/${total}` : '0/0';
        this.currentPrevBtn.disabled = total === 0;
        this.currentNextBtn.disabled = total === 0;
    }

    /**
     * Move to the next or previous current-file search match.
     *
     * @param {1 | -1} [direction]
     */
    goToMatch(direction = 1) {
        if (this.matches.length === 0) return;
        this.matchIndex = (this.matchIndex + direction + this.matches.length) % this.matches.length;
        const match = this.matches[this.matchIndex];

        if (match instanceof HTMLElement) {
            match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (match.pageNum) {
            const pageNode = this.pdfWrapper.querySelector(`[data-page="${match.pageNum}"]`);
            if (pageNode) pageNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        this.updateUI();
    }

    /**
     * Run current-file search for the active Markdown/PDF viewer.
     *
     * @returns {Promise<void>}
     */
    async run() {
        const query = this.currentSearchInput.value.trim();
        this.searchInput.value = query;
        this.clearSearchBtn.classList.toggle('hidden', !query);
        this.currentSearchBar.classList.remove('hidden');

        try {
            const currentFile = this.getCurrentFile();
            if (!currentFile) {
                this.matches = [];
                this.matchIndex = -1;
                this.currentSearchCount.textContent = '未選択';
                this.currentPrevBtn.disabled = true;
                this.currentNextBtn.disabled = true;
                return;
            }

            if (currentFile.type === 'md') {
                this.highlightMarkdownMatches(query);
            } else {
                await this.searchPdf(query);
            }

            this.updateUI();
            if (this.matches.length > 0) this.goToMatch(1);
        } catch (error) {
            this.matches = [];
            this.matchIndex = -1;
            this.currentSearchCount.textContent = 'エラー';
        }
    }
}
