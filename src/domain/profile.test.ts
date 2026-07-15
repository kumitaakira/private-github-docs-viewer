import { describe, expect, it } from 'vitest';
import { createRepositoryProfile, fileTypeFromName, normalizeRootPath } from './profile';

describe('repository profile domain', () => {
  it('creates a stable id and display name fallback', () => {
    const profile = createRepositoryProfile({
      repo: 'example-owner/example-docs',
      rootPath: '/docs/exams/',
      token: 'dummy-token',
    });

    expect(profile.id).toBe('example-owner_example-docs:docs_exams');
    expect(profile.name).toBe('example-owner/example-docs/docs/exams');
    expect(profile.rootPath).toBe('docs/exams');
  });

  it('keeps explicit display names editable', () => {
    const profile = createRepositoryProfile({
      displayName: '院試資料',
      repo: 'example-owner/example-docs',
      token: 'dummy-token',
    });

    expect(profile.name).toBe('院試資料');
    expect(profile.displayName).toBe('院試資料');
  });

  it('normalizes paths and file types', () => {
    expect(normalizeRootPath('/past/questions/')).toBe('past/questions');
    expect(fileTypeFromName('answer.PDF')).toBe('pdf');
    expect(fileTypeFromName('answer.md')).toBe('md');
  });
});
