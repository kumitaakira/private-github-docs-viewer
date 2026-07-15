import type { RepositoryProfile } from '../../domain/models';
import { normalizeRootPath } from '../../domain/profile';
import { searchMarkdownCode } from '../../infrastructure/github/GitHubClient';

export async function searchMarkdownContent(profile: RepositoryProfile, query: string, signal?: AbortSignal) {
  const rootPath = normalizeRootPath(profile.rootPath);
  const queryParts = [query, `repo:${profile.repo}`, 'extension:md'];
  if (rootPath) queryParts.push(`path:${rootPath}`);
  const data = await searchMarkdownCode(profile, queryParts, { signal });
  return (data.items || []).map((item) => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    type: 'md' as const,
    fragment: item.text_matches?.[0]?.fragment || '',
  }));
}
