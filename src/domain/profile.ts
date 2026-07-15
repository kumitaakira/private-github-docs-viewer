import type { RepositoryProfile, RepositoryProfileInput, SupportedFileType } from './models';

export function createProfileId(repo: string, rootPath: string) {
  return `${repo}:${rootPath || ''}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export function createRepositoryProfile(
  input: RepositoryProfileInput,
  previous?: RepositoryProfile,
): RepositoryProfile {
  const rootPath = (input.rootPath || '').replace(/^\/+|\/+$/g, '');
  const fallbackName = rootPath ? `${input.repo}/${rootPath}` : input.repo;
  const displayName = input.displayName?.trim() || '';
  return {
    ...previous,
    id: createProfileId(input.repo, rootPath),
    name: displayName || fallbackName,
    displayName,
    repo: input.repo,
    rootPath,
    token: input.token,
    cachePdfBlobs: Boolean(input.cachePdfBlobs),
    updatedAt: Date.now(),
  };
}

export function normalizeRootPath(rootPath: string) {
  return rootPath.replace(/^\/+|\/+$/g, '');
}

export function fileTypeFromName(name: string): SupportedFileType {
  return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'md';
}
