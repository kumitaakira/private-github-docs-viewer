import type { RepositoryIndex, RepositoryProfile, ViewerFile } from '../../domain/models';
import { fileTypeFromName, normalizeRootPath } from '../../domain/profile';
import { fetchRecursiveTree, fetchRepository } from '../../infrastructure/github/GitHubClient';
import {
  readRepositoryIndexCache,
  writeRepositoryIndexCache,
} from '../../infrastructure/storage/repositoryIndexCache';

export async function loadRepositoryIndex(
  profile: RepositoryProfile,
  signal?: AbortSignal,
): Promise<RepositoryIndex> {
  const cached = readRepositoryIndexCache(profile);
  if (cached && !cached.stale) return cached;

  try {
    const repo = await fetchRepository(profile, { signal });
    const tree = await fetchRecursiveTree(profile, repo.default_branch || 'HEAD', { signal });
    const rootPath = normalizeRootPath(profile.rootPath);
    const files: ViewerFile[] = (tree.tree || [])
      .filter((item) => item.type === 'blob')
      .filter((item) => item.path.toLowerCase().endsWith('.md') || item.path.toLowerCase().endsWith('.pdf'))
      .filter((item) => !rootPath || item.path === rootPath || item.path.startsWith(`${rootPath}/`))
      .map((item) => ({
        name: item.path.split('/').pop() || item.path,
        path: item.path,
        sha: item.sha,
        type: fileTypeFromName(item.path),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    writeRepositoryIndexCache(profile, files, Boolean(tree.truncated));
    return { files, truncated: Boolean(tree.truncated), fromCache: false, stale: false };
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}
