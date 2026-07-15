import type { RepositoryProfile, ViewerFile } from '../../domain/models';
import { fetchBlob } from '../../infrastructure/github/GitHubClient';
import { readPdfCache, writePdfCache } from '../../infrastructure/storage/pdfBlobCache';

export function decodeBase64Bytes(base64: string) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeBase64Utf8(base64: string) {
  return new TextDecoder('utf-8').decode(decodeBase64Bytes(base64));
}

export async function loadMarkdown(profile: RepositoryProfile, file: ViewerFile, signal?: AbortSignal) {
  const data = await fetchBlob(profile, file.sha, { signal });
  return decodeBase64Utf8(data.content);
}

export async function loadPdfBytes(profile: RepositoryProfile, file: ViewerFile, signal?: AbortSignal) {
  if (profile.cachePdfBlobs) {
    const cached = await readPdfCache(profile, file);
    if (cached) return cached;
  }

  const data = await fetchBlob(profile, file.sha, { signal });
  const bytes = decodeBase64Bytes(data.content);
  if (profile.cachePdfBlobs) await writePdfCache(profile, file, bytes);
  return bytes;
}
