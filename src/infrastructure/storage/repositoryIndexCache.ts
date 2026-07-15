import type { RepositoryIndex, RepositoryProfile, ViewerFile } from '../../domain/models';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'github_docs_repository_index';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_BYTES = 1024 * 1024;
const CACHE_MAX_ENTRIES = 8;

type CachePayload = {
  version: number;
  savedAt: number;
  truncated: boolean;
  files: ViewerFile[];
};

function cacheKey(profile: RepositoryProfile) {
  return `${CACHE_PREFIX}:${CACHE_VERSION}:${profile.repo}:${profile.rootPath}`;
}

export function readRepositoryIndexCache(profile: RepositoryProfile): RepositoryIndex | null {
  try {
    const raw = localStorage.getItem(cacheKey(profile));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.files)) return null;
    return {
      files: parsed.files,
      truncated: Boolean(parsed.truncated),
      fromCache: true,
      stale: Date.now() - Number(parsed.savedAt || 0) > CACHE_MAX_AGE_MS,
    };
  } catch {
    return null;
  }
}

export function writeRepositoryIndexCache(
  profile: RepositoryProfile,
  files: ViewerFile[],
  truncated: boolean,
) {
  try {
    const payload = JSON.stringify({
      version: CACHE_VERSION,
      savedAt: Date.now(),
      truncated,
      files,
    });
    if (new Blob([payload]).size > CACHE_MAX_BYTES) return;
    localStorage.setItem(cacheKey(profile), payload);
    pruneRepositoryIndexCache();
  } catch {
    // Cache is best-effort.
  }
}

function pruneRepositoryIndexCache() {
  const entries: Array<{ key: string; savedAt: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(`${CACHE_PREFIX}:`)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}') as { savedAt?: number };
      entries.push({ key, savedAt: Number(value.savedAt || 0) });
    } catch {
      entries.push({ key, savedAt: 0 });
    }
  }

  const now = Date.now();
  entries
    .filter((entry) => now - entry.savedAt > CACHE_MAX_AGE_MS)
    .forEach((entry) => localStorage.removeItem(entry.key));

  entries
    .filter((entry) => localStorage.getItem(entry.key) !== null)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(CACHE_MAX_ENTRIES)
    .forEach((entry) => localStorage.removeItem(entry.key));
}
