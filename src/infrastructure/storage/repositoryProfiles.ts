import { createCollection, localStorageCollectionOptions } from '@tanstack/db';
import type { LastOpenedFile, RepositoryProfile, RepositoryProfileInput } from '../../domain/models';
import { createRepositoryProfile } from '../../domain/profile';
import {
  lastOpenedFileSchema,
  legacyLastOpenedFileSchema,
  repositoryProfileSchema,
} from '../../domain/schemas';

const PROFILES_KEY = 'github_repository_profiles';
const ACTIVE_PROFILE_KEY = 'github_active_repository_profile';
const LAST_OPENED_KEY = 'github_docs_last_opened_file';

export const repositoryProfilesCollection = createCollection(
  localStorageCollectionOptions<RepositoryProfile, string>({
    id: 'repository-profiles',
    storageKey: PROFILES_KEY,
    getKey: (profile) => profile.id,
  }),
);

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function migrateLegacyProfileSettings(): RepositoryProfile[] {
  const existing = getRepositoryProfiles();
  if (existing.length > 0) return existing;

  const repo = localStorage.getItem('github_target_repo') || '';
  const token = localStorage.getItem('github_pat') || '';
  if (!repo || !token) return [];

  const profile = createRepositoryProfile({
    repo,
    rootPath: localStorage.getItem('github_target_path') || '',
    token,
    cachePdfBlobs: localStorage.getItem('github_cache_pdf_blobs') === 'true',
  });

  writeJson(PROFILES_KEY, [profile]);
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
  return [profile];
}

export function getRepositoryProfiles(): RepositoryProfile[] {
  const profiles = readJson<unknown[]>(PROFILES_KEY, []);
  return profiles
    .map((profile) => repositoryProfileSchema.safeParse(profile))
    .filter((result) => result.success)
    .map((result) => result.data);
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
}

export function setActiveProfileId(id: string) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

export function getActiveProfile() {
  const profiles = migrateLegacyProfileSettings();
  const activeId = getActiveProfileId();
  return profiles.find((profile) => profile.id === activeId) || profiles[0] || null;
}

export function saveRepositoryProfile(input: RepositoryProfileInput) {
  const profiles = getRepositoryProfiles();
  const next = createRepositoryProfile(
    input,
    profiles.find((profile) => profile.id === createRepositoryProfile(input).id),
  );
  const index = profiles.findIndex((profile) => profile.id === next.id);
  if (index >= 0) profiles[index] = next;
  else profiles.unshift(next);
  writeJson(PROFILES_KEY, profiles);
  setActiveProfileId(next.id);
  persistLegacySettings(next);
  return next;
}

export function removeRepositoryProfile(id: string) {
  const profiles = getRepositoryProfiles().filter((profile) => profile.id !== id);
  writeJson(PROFILES_KEY, profiles);
  if (getActiveProfileId() === id) setActiveProfileId(profiles[0]?.id || '');
}

export function persistLegacySettings(profile: RepositoryProfile) {
  localStorage.setItem('github_target_repo', profile.repo);
  localStorage.setItem('github_target_path', profile.rootPath);
  localStorage.setItem('github_pat', profile.token);
  localStorage.setItem('github_cache_pdf_blobs', profile.cachePdfBlobs ? 'true' : 'false');
}

export function getLastOpenedFile(profile: RepositoryProfile): LastOpenedFile | null {
  const parsed = lastOpenedFileSchema.safeParse(readJson(LAST_OPENED_KEY, null));
  if (parsed.success && parsed.data.profileId === profile.id) return parsed.data;

  const legacy = legacyLastOpenedFileSchema.safeParse(readJson(LAST_OPENED_KEY, null));
  if (!legacy.success) return null;
  if (legacy.data.repo !== profile.repo || legacy.data.rootPath !== profile.rootPath) return null;

  return {
    profileId: profile.id,
    file: {
      name: legacy.data.name,
      path: legacy.data.path,
      sha: legacy.data.sha,
      type: legacy.data.type,
    },
  };
}

export function saveLastOpenedFile(profile: RepositoryProfile, file: LastOpenedFile['file']) {
  writeJson(LAST_OPENED_KEY, { profileId: profile.id, file });
}
