import type {
  GitHubContentItem,
  GitHubSearchItem,
  GitHubTreeItem,
  RepositoryProfile,
} from '../../domain/models';

const API_BASE = 'https://api.github.com';

type RequestOptions = {
  signal?: AbortSignal;
  accept?: string;
  label?: string;
};

async function githubJson<T>(
  profile: RepositoryProfile,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${profile.token}`,
      Accept: options.accept || 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) throw new Error(`${options.label || 'github'} ${response.status}`);
  return response.json() as Promise<T>;
}

export function fetchRepository(profile: RepositoryProfile, options: RequestOptions = {}) {
  return githubJson<{ default_branch?: string }>(profile, `/repos/${profile.repo}`, {
    ...options,
    label: 'repo',
  });
}

export function fetchRecursiveTree(profile: RepositoryProfile, branch: string, options: RequestOptions = {}) {
  return githubJson<{ tree?: GitHubTreeItem[]; truncated?: boolean }>(
    profile,
    `/repos/${profile.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { ...options, label: 'tree' },
  );
}

export function fetchContents(profile: RepositoryProfile, path: string, options: RequestOptions = {}) {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  return githubJson<GitHubContentItem[] | GitHubContentItem>(
    profile,
    `/repos/${profile.repo}/contents/${normalizedPath}`,
    { ...options, label: 'contents' },
  );
}

export function fetchBlob(profile: RepositoryProfile, sha: string, options: RequestOptions = {}) {
  return githubJson<{ content: string }>(profile, `/repos/${profile.repo}/git/blobs/${sha}`, {
    ...options,
    label: 'blob',
  });
}

export function searchMarkdownCode(
  profile: RepositoryProfile,
  queryParts: string[],
  options: RequestOptions = {},
) {
  const query = encodeURIComponent(queryParts.join(' '));
  return githubJson<{ items?: GitHubSearchItem[] }>(profile, `/search/code?q=${query}&per_page=30`, {
    ...options,
    label: 'search',
    accept: 'application/vnd.github.v3.text-match+json',
  });
}
