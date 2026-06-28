const API_BASE = 'https://api.github.com';

/**
 * Fetch and parse a GitHub REST API JSON response.
 *
 * @param {import('../core/types.js').AppSettings} settings
 * @param {string} path API path beginning with "/".
 * @param {{ accept?: string, label?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
async function githubJson(settings, path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        signal: options.signal,
        headers: {
            'Authorization': `Bearer ${settings.token}`,
            'Accept': options.accept || 'application/vnd.github.v3+json'
        }
    });
    if (!response.ok) throw new Error(`${options.label || 'github'} ${response.status}`);
    return response.json();
}

/**
 * @param {import('../core/types.js').AppSettings} settings
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ default_branch?: string }>}
 */
export function fetchRepository(settings, options = {}) {
    return githubJson(settings, `/repos/${settings.repo}`, { ...options, label: 'repo' });
}

/**
 * @param {import('../core/types.js').AppSettings} settings
 * @param {string} branch
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ tree?: import('../core/types.js').GitHubTreeItem[], truncated?: boolean }>}
 */
export function fetchRecursiveTree(settings, branch, options = {}) {
    return githubJson(settings, `/repos/${settings.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { ...options, label: 'tree' });
}

/**
 * @param {import('../core/types.js').AppSettings} settings
 * @param {string} path
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export function fetchContents(settings, path, options = {}) {
    return githubJson(settings, `/repos/${settings.repo}/contents/${path}`, { ...options, label: 'contents' });
}

/**
 * @param {import('../core/types.js').AppSettings} settings
 * @param {string} sha
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ content: string }>}
 */
export function fetchBlob(settings, sha, options = {}) {
    return githubJson(settings, `/repos/${settings.repo}/git/blobs/${sha}`, { ...options, label: 'blob' });
}

/**
 * @param {import('../core/types.js').AppSettings} settings
 * @param {string[]} queryParts GitHub code search query parts.
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ items?: Array<{ name: string, path: string, sha: string, text_matches?: Array<{ fragment: string }> }> }>}
 */
export function searchMarkdownCode(settings, queryParts, options = {}) {
    const query = encodeURIComponent(queryParts.join(' '));
    return githubJson(settings, `/search/code?q=${query}&per_page=30`, {
        ...options,
        label: 'search',
        accept: 'application/vnd.github.v3.text-match+json'
    });
}
