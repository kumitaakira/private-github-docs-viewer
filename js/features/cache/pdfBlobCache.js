const DB_NAME = 'github_docs_pdf_cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const MOBILE_MAX_BYTES = 40 * 1024 * 1024;

/**
 * @typedef {Object} PdfCacheEntry
 * @property {string} key
 * @property {string} repo
 * @property {string} path
 * @property {string} sha
 * @property {string} name
 * @property {number} size
 * @property {number} accessedAt
 * @property {number} updatedAt
 * @property {ArrayBuffer} bytes
 */

/**
 * IndexedDB-backed cache for optional PDF binary storage.
 */
export class PdfBlobCache {
    /**
     * @param {{ isMobile?: () => boolean }} [options]
     */
    constructor(options = {}) {
        this.dbPromise = null;
        this.isMobile = options.isMobile || (() => window.matchMedia('(max-width: 767px)').matches);
    }

    /**
     * @returns {number}
     */
    getMaxBytes() {
        return this.isMobile() ? MOBILE_MAX_BYTES : DEFAULT_MAX_BYTES;
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @param {{ path: string, sha: string }} file
     * @returns {string}
     */
    getKey(settings, file) {
        return `${settings.repo}:${file.path}:${file.sha}`;
    }

    /**
     * @returns {Promise<IDBDatabase>}
     */
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
                    store.createIndex('repo', 'repo');
                }
            };
            request.onsuccess = () => resolve(request.result);
        });

        return this.dbPromise;
    }

    /**
     * @param {IDBRequest} request
     * @returns {Promise<any>}
     */
    requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * @param {IDBTransaction} transaction
     * @returns {Promise<void>}
     */
    transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    /**
     * @param {string} key
     * @returns {Promise<PdfCacheEntry | null>}
     */
    async getEntry(key) {
        const db = await this.open();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const entry = await this.requestToPromise(transaction.objectStore(STORE_NAME).get(key));
        await this.transactionDone(transaction);
        return entry || null;
    }

    /**
     * @returns {Promise<PdfCacheEntry[]>}
     */
    async getAllEntries() {
        const db = await this.open();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const entries = await this.requestToPromise(transaction.objectStore(STORE_NAME).getAll());
        await this.transactionDone(transaction);
        return entries;
    }

    /**
     * @param {PdfCacheEntry} entry
     * @returns {Promise<void>}
     */
    async putEntry(entry) {
        const db = await this.open();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(entry);
        await this.transactionDone(transaction);
    }

    /**
     * @param {string[]} keys
     * @returns {Promise<void>}
     */
    async deleteEntries(keys) {
        if (keys.length === 0) return;
        const db = await this.open();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        keys.forEach(key => store.delete(key));
        await this.transactionDone(transaction);
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @param {{ path: string, sha: string }} file
     * @returns {Promise<Uint8Array | null>}
     */
    async get(settings, file) {
        try {
            const entry = await this.getEntry(this.getKey(settings, file));
            if (!entry?.bytes) return null;

            entry.accessedAt = Date.now();
            this.putEntry(entry).catch(() => {});
            return new Uint8Array(entry.bytes);
        } catch (error) {
            return null;
        }
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @param {{ path: string, sha: string, name: string }} file
     * @param {Uint8Array} bytes
     * @returns {Promise<void>}
     */
    async put(settings, file, bytes) {
        try {
            if (bytes.byteLength > this.getMaxBytes()) return;

            const now = Date.now();
            const entry = {
                key: this.getKey(settings, file),
                repo: settings.repo,
                path: file.path,
                sha: file.sha,
                name: file.name,
                size: bytes.byteLength,
                accessedAt: now,
                updatedAt: now,
                bytes: bytes.slice().buffer
            };

            await this.putEntry(entry);
            await this.prune();
        } catch (error) {
            // PDF viewing should continue even when storage is unavailable or full.
        }
    }

    /**
     * Remove least-recently-used PDFs until the cache is under the current device cap.
     *
     * @returns {Promise<void>}
     */
    async prune() {
        const entries = await this.getAllEntries();
        const maxBytes = this.getMaxBytes();
        let totalBytes = entries.reduce((total, entry) => total + Number(entry.size || 0), 0);
        if (totalBytes <= maxBytes) return;

        const staleEntries = entries
            .slice()
            .sort((a, b) => Number(a.accessedAt || 0) - Number(b.accessedAt || 0));

        const deleteKeys = [];
        for (const entry of staleEntries) {
            if (totalBytes <= maxBytes) break;
            deleteKeys.push(entry.key);
            totalBytes -= Number(entry.size || 0);
        }
        await this.deleteEntries(deleteKeys);
    }

    /**
     * @returns {Promise<{ count: number, bytes: number, maxBytes: number }>}
     */
    async getUsage() {
        try {
            const entries = await this.getAllEntries();
            return {
                count: entries.length,
                bytes: entries.reduce((total, entry) => total + Number(entry.size || 0), 0),
                maxBytes: this.getMaxBytes()
            };
        } catch (error) {
            return { count: 0, bytes: 0, maxBytes: this.getMaxBytes() };
        }
    }
}

export { DEFAULT_MAX_BYTES, MOBILE_MAX_BYTES };
