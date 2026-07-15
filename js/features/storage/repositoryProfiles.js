const PROFILES_KEY = 'github_repository_profiles';
const ACTIVE_PROFILE_KEY = 'github_active_repository_profile';

/**
 * @typedef {import('../../core/types.js').AppSettings & { id: string, name: string, displayName: string, updatedAt: number }} RepositoryProfile
 */

function createProfileId(repo, path) {
    return `${repo}:${path || ''}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
    } catch (error) {
        return fallback;
    }
}

export class RepositoryProfileStore {
    /**
     * @returns {RepositoryProfile[]}
     */
    getAll() {
        const profiles = readJson(PROFILES_KEY, []);
        return Array.isArray(profiles) ? profiles : [];
    }

    /**
     * @param {RepositoryProfile[]} profiles
     */
    saveAll(profiles) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    }

    /**
     * @returns {string}
     */
    getActiveId() {
        return localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
    }

    /**
     * @param {string} id
     */
    setActiveId(id) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    }

    /**
     * Move legacy single-repository settings into the profile list once.
     *
     * @returns {RepositoryProfile[]}
     */
    migrateLegacySettings() {
        const profiles = this.getAll();
        if (profiles.length > 0) return profiles;

        const repo = localStorage.getItem('github_target_repo') || '';
        const token = localStorage.getItem('github_pat') || '';
        if (!repo || !token) return profiles;

        const profile = this.build({
            repo,
            path: localStorage.getItem('github_target_path') || '',
            token,
            cachePdfBlobs: localStorage.getItem('github_cache_pdf_blobs') === 'true'
        });
        this.saveAll([profile]);
        this.setActiveId(profile.id);
        return [profile];
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @returns {RepositoryProfile}
     */
    build(settings) {
        const id = createProfileId(settings.repo, settings.path);
        const fallbackName = settings.path ? `${settings.repo}/${settings.path}` : settings.repo;
        return {
            id,
            name: settings.displayName || fallbackName,
            displayName: settings.displayName || '',
            repo: settings.repo,
            path: settings.path,
            token: settings.token,
            cachePdfBlobs: Boolean(settings.cachePdfBlobs),
            updatedAt: Date.now()
        };
    }

    /**
     * @param {import('../../core/types.js').AppSettings} settings
     * @returns {RepositoryProfile}
     */
    upsert(settings) {
        const profile = this.build(settings);
        const profiles = this.getAll();
        const index = profiles.findIndex(item => item.id === profile.id);
        if (index >= 0) profiles[index] = { ...profiles[index], ...profile };
        else profiles.unshift(profile);

        this.saveAll(profiles);
        this.setActiveId(profile.id);
        return profile;
    }

    /**
     * @returns {RepositoryProfile | null}
     */
    getActive() {
        const profiles = this.migrateLegacySettings();
        const activeId = this.getActiveId();
        return profiles.find(profile => profile.id === activeId) || profiles[0] || null;
    }

    /**
     * @param {string} id
     * @returns {RepositoryProfile | null}
     */
    getById(id) {
        return this.getAll().find(profile => profile.id === id) || null;
    }

    /**
     * @param {string} id
     */
    remove(id) {
        const profiles = this.getAll().filter(profile => profile.id !== id);
        this.saveAll(profiles);
        if (this.getActiveId() === id) this.setActiveId(profiles[0]?.id || '');
    }
}
