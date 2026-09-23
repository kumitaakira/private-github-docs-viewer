function decodePath(value) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function normalizePath(path) {
    const parts = [];
    path.split('/').forEach(part => {
        if (!part || part === '.') return;
        if (part === '..') parts.pop();
        else parts.push(part);
    });
    return parts.join('/');
}

function splitTarget(href) {
    const hashIndex = href.indexOf('#');
    const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
    const queryIndex = beforeHash.indexOf('?');
    return {
        path: decodePath(queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex)),
        hash: decodePath(hash)
    };
}

function isExternalLink(href) {
    return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}

/**
 * Resolve a Markdown link against the active repository document.
 * Returns null for external/web links.
 */
export function resolveRepositoryDocumentLink(href, currentFilePath, files) {
    const rawHref = String(href || '').trim();
    if (!rawHref || isExternalLink(rawHref)) return null;

    const { path: targetPath, hash } = splitTarget(rawHref);
    if (!targetPath) return { file: null, hash, sameDocument: true };

    const baseParts = currentFilePath.split('/');
    baseParts.pop();
    const repositoryPath = targetPath.startsWith('/')
        ? normalizePath(targetPath)
        : normalizePath(`${baseParts.join('/')}/${targetPath}`);
    const withoutTrailingSlash = repositoryPath.replace(/\/+$/, '');
    const candidates = [repositoryPath];
    if (targetPath.endsWith('/') || !/\.[^/]+$/.test(withoutTrailingSlash)) {
        candidates.push(`${withoutTrailingSlash}/README.md`, `${withoutTrailingSlash}/readme.md`, `${withoutTrailingSlash}/index.md`);
    }

    const file = candidates.map(candidate => files.find(item => item.path === candidate)).find(Boolean) || null;
    return { file, hash, sameDocument: file?.path === currentFilePath, repositoryPath };
}
