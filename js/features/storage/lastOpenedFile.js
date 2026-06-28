export class LastOpenedFileStore {
    /**
     * @param {string} key localStorage key.
     */
    constructor(key) {
        this.key = key;
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @returns {(import('../../core/types.js').ViewerFile & { repo: string, rootPath: string }) | null}
     */
    get(settings) {
        try {
            const file = JSON.parse(localStorage.getItem(this.key) || 'null');
            if (!file || file.repo !== settings.repo || file.rootPath !== settings.path) return null;
            return file;
        } catch (error) {
            return null;
        }
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @param {Pick<import('../../core/types.js').ViewerFile, 'name' | 'path' | 'sha'>} file
     * @param {import('../../core/types.js').SupportedFileType} type
     */
    save(settings, file, type) {
        localStorage.setItem(this.key, JSON.stringify({
            repo: settings.repo,
            rootPath: settings.path,
            path: file.path,
            name: file.name,
            sha: file.sha,
            type
        }));
    }

    /**
     * Remove the saved file pointer.
     */
    clear() {
        localStorage.removeItem(this.key);
    }
}
