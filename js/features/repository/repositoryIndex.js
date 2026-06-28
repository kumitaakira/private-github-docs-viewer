import { fetchRecursiveTree, fetchRepository } from '../../api/github.js';

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
    }

    /**
     * Clear the cached recursive tree result after repository settings change.
     */
    clear() {
        this.files = null;
        this.truncated = false;
    }

    /**
     * Load and cache Markdown/PDF files from the repository tree.
     *
     * @returns {Promise<{ files: import('../../core/types.js').ViewerFile[], truncated: boolean }>}
     */
    async load() {
        if (this.files) return {
            files: this.files,
            truncated: this.truncated
        };

        const settings = this.settingsProvider();
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

        return {
            files: this.files,
            truncated: this.truncated
        };
    }
}

export { fileTypeFromName, normalizeRootPath };
