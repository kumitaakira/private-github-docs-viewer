import { fetchRecursiveTree, fetchRepository } from '../../api/github.js';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'github_docs_repository_index';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_BYTES = 1024 * 1024;
const CACHE_MAX_ENTRIES = 8;

/**
 * @param {import('../../core/types.js').AppSettings} settings
 * @returns {string}
 */
function normalizeRootPath(settings) {
    return settings.path.replace(/^\/+|\/+$/g, '');
}

/**
 * @param {string} name
 * @returns {import('../../core/types.js').SupportedFileType}
 */
function fileTypeFromName(name) {
    return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'md';
}

export class RepositoryIndex {
    /**
     * @param {() => import('../../core/types.js').AppSettings} settingsProvider
     */
    constructor(settingsProvider) {
        this.settingsProvider = settingsProvider;
        this.files = null;
        this.truncated = false;
        this.fromCache = false;
        this.stale = false;
    }

    /**
     * Clear the cached recursive tree result after repository settings change.
     */
    clear() {
        this.files = null;
        this.truncated = false;
        this.fromCache = false;
        this.stale = false;
    }

    /**
     * Load and cache Markdown/PDF files from the repository tree.
     *
     * @returns {Promise<{ files: import('../../core/types.js').ViewerFile[], truncated: boolean, fromCache: boolean, stale: boolean }>}
     */
    async load() {
        if (this.files) return {
            files: this.files,
            truncated: this.truncated,
            fromCache: this.fromCache,
            stale: this.stale
        };

        const settings = this.settingsProvider();
        const cached = this.readPersistentCache(settings);
        if (cached && !cached.stale) return this.applyCache(cached);

        try {
            const repoData = await fetchRepository(settings);
            const treeData = await fetchRecursiveTree(settings, repoData.default_branch || 'HEAD');
            const rootPath = normalizeRootPath(settings);

            this.files = (treeData.tree || [])
                .filter(item => item.type === 'blob')
                .filter(item => item.path.toLowerCase().endsWith('.md') || item.path.toLowerCase().endsWith('.pdf'))
                .filter(item => !rootPath || item.path === rootPath || item.path.startsWith(`${rootPath}/`))
                .map(item => ({
                    name: item.path.split('/').pop(),
                    path: item.path,
                    sha: item.sha,
                    type: fileTypeFromName(item.path)
                }))
                .sort((a, b) => a.path.localeCompare(b.path));
            this.truncated = Boolean(treeData.truncated);
            this.fromCache = false;
            this.stale = false;
            this.writePersistentCache(settings);

            return {
                files: this.files,
                truncated: this.truncated,
                fromCache: this.fromCache,
                stale: this.stale
            };
        } catch (error) {
            if (cached) return this.applyCache(cached);
            throw error;
        }
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @returns {string}
     */
    getCacheKey(settings) {
        return `${CACHE_PREFIX}:${CACHE_VERSION}:${settings.repo}:${normalizeRootPath(settings)}`;
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @returns {{ files: import('../../core/types.js').ViewerFile[], truncated: boolean, stale: boolean } | null}
     */
    readPersistentCache(settings) {
        try {
            const raw = localStorage.getItem(this.getCacheKey(settings));
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.files)) return null;

            return {
                files: parsed.files,
                truncated: Boolean(parsed.truncated),
                stale: Date.now() - Number(parsed.savedAt || 0) > CACHE_MAX_AGE_MS
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * @param {{ files: import('../../core/types.js').ViewerFile[], truncated: boolean, stale: boolean }} cache
     * @returns {{ files: import('../../core/types.js').ViewerFile[], truncated: boolean, fromCache: boolean, stale: boolean }}
     */
    applyCache(cache) {
        this.files = cache.files;
        this.truncated = cache.truncated;
        this.fromCache = true;
        this.stale = cache.stale;

        return {
            files: this.files,
            truncated: this.truncated,
            fromCache: this.fromCache,
            stale: this.stale
        };
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     */
    writePersistentCache(settings) {
        try {
            const payload = JSON.stringify({
                version: CACHE_VERSION,
                savedAt: Date.now(),
                truncated: this.truncated,
                files: this.files
            });

            if (new Blob([payload]).size > CACHE_MAX_BYTES) return;
            localStorage.setItem(this.getCacheKey(settings), payload);
            this.prunePersistentCaches();
        } catch (error) {
            // Storage may be full or unavailable; fetching still works without this cache.
        }
    }

    /**
     * Keep repository index caches bounded across repositories/paths.
     */
    prunePersistentCaches() {
        try {
            const entries = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(`${CACHE_PREFIX}:`)) continue;

                try {
                    const value = JSON.parse(localStorage.getItem(key) || '{}');
                    entries.push({ key, savedAt: Number(value.savedAt || 0) });
                } catch (error) {
                    entries.push({ key, savedAt: 0 });
                }
            }

            const now = Date.now();
            entries
                .filter(entry => now - entry.savedAt > CACHE_MAX_AGE_MS)
                .forEach(entry => localStorage.removeItem(entry.key));

            entries
                .filter(entry => localStorage.getItem(entry.key) !== null)
                .sort((a, b) => b.savedAt - a.savedAt)
                .slice(CACHE_MAX_ENTRIES)
                .forEach(entry => localStorage.removeItem(entry.key));
        } catch (error) {
            // Cache pruning is best-effort.
        }
    }
}

export { fileTypeFromName, normalizeRootPath };
