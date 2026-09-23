const DB_NAME = 'github_docs_markdown_cache';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const DESKTOP_MAX_BYTES = 20 * 1024 * 1024;
const MOBILE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 200;

export class MarkdownTextCache {
    constructor({ isMobile = () => window.matchMedia('(max-width: 767px)').matches } = {}) {
        this.dbPromise = null;
        this.isMobile = isMobile;
    }

    getMaxBytes() {
        return this.isMobile() ? MOBILE_MAX_BYTES : DESKTOP_MAX_BYTES;
    }

    getKey(settings, file) {
        return `${settings.repo}:${file.path}:${file.sha}`;
    }

    open() {
        if (this.dbPromise) return this.dbPromise;
        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('accessedAt', 'accessedAt');
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
        return this.dbPromise;
    }

    request(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async get(settings, file) {
        try {
            const db = await this.open();
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const entry = await this.request(transaction.objectStore(STORE_NAME).get(this.getKey(settings, file)));
            await this.transactionDone(transaction);
            if (!entry?.text) return null;

            entry.accessedAt = Date.now();
            const update = db.transaction(STORE_NAME, 'readwrite');
            update.objectStore(STORE_NAME).put(entry);
            this.transactionDone(update).catch(() => {});
            return entry.text;
        } catch (error) {
            return null;
        }
    }

    async put(settings, file, text) {
        try {
            const size = new Blob([text]).size;
            if (size > this.getMaxBytes()) return;

            const db = await this.open();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put({
                key: this.getKey(settings, file),
                repo: settings.repo,
                path: file.path,
                sha: file.sha,
                text,
                size,
                accessedAt: Date.now()
            });
            await this.transactionDone(transaction);
            await this.prune();
        } catch (error) {
            // Markdown remains readable when persistent storage is unavailable.
        }
    }

    async prune() {
        const db = await this.open();
        const read = db.transaction(STORE_NAME, 'readonly');
        const entries = await this.request(read.objectStore(STORE_NAME).getAll());
        await this.transactionDone(read);

        const ordered = entries.sort((a, b) => Number(a.accessedAt || 0) - Number(b.accessedAt || 0));
        let totalBytes = ordered.reduce((total, entry) => total + Number(entry.size || 0), 0);
        const deleteKeys = [];
        while (ordered.length > MAX_ENTRIES || totalBytes > this.getMaxBytes()) {
            const entry = ordered.shift();
            if (!entry) break;
            deleteKeys.push(entry.key);
            totalBytes -= Number(entry.size || 0);
        }
        if (deleteKeys.length === 0) return;

        const remove = db.transaction(STORE_NAME, 'readwrite');
        const store = remove.objectStore(STORE_NAME);
        deleteKeys.forEach(key => store.delete(key));
        await this.transactionDone(remove);
    }
}
