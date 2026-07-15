import type { RepositoryProfile, ViewerFile } from '../../domain/models';

const DB_NAME = 'github_docs_pdf_cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';
export const DEFAULT_PDF_CACHE_MAX_BYTES = 100 * 1024 * 1024;
export const MOBILE_PDF_CACHE_MAX_BYTES = 40 * 1024 * 1024;

type PdfCacheEntry = {
  key: string;
  repo: string;
  path: string;
  sha: string;
  name: string;
  size: number;
  accessedAt: number;
  updatedAt: number;
  bytes: ArrayBuffer;
};

function key(profile: RepositoryProfile, file: Pick<ViewerFile, 'path' | 'sha'>) {
  return `${profile.repo}:${file.path}:${file.sha}`;
}

function maxBytes() {
  return window.matchMedia('(max-width: 767px)').matches
    ? MOBILE_PDF_CACHE_MAX_BYTES
    : DEFAULT_PDF_CACHE_MAX_BYTES;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('accessedAt', 'accessedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function allEntries() {
  const db = await openDb();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  return requestToPromise<PdfCacheEntry[]>(transaction.objectStore(STORE_NAME).getAll());
}

export async function readPdfCache(profile: RepositoryProfile, file: Pick<ViewerFile, 'path' | 'sha'>) {
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const entry = await requestToPromise<PdfCacheEntry | undefined>(
      transaction.objectStore(STORE_NAME).get(key(profile, file)),
    );
    if (!entry) return null;
    entry.accessedAt = Date.now();
    transaction.objectStore(STORE_NAME).put(entry);
    return new Uint8Array(entry.bytes);
  } catch {
    return null;
  }
}

export async function writePdfCache(profile: RepositoryProfile, file: ViewerFile, bytes: Uint8Array) {
  try {
    if (bytes.byteLength > maxBytes()) return;
    const db = await openDb();
    const now = Date.now();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      key: key(profile, file),
      repo: profile.repo,
      path: file.path,
      sha: file.sha,
      name: file.name,
      size: bytes.byteLength,
      accessedAt: now,
      updatedAt: now,
      bytes: bytes.slice().buffer,
    } satisfies PdfCacheEntry);
    await prunePdfCache();
  } catch {
    // PDF display still works without cache.
  }
}

export async function getPdfCacheUsage() {
  try {
    const entries = await allEntries();
    return {
      count: entries.length,
      bytes: entries.reduce((total, entry) => total + Number(entry.size || 0), 0),
      maxBytes: maxBytes(),
    };
  } catch {
    return { count: 0, bytes: 0, maxBytes: maxBytes() };
  }
}

export async function prunePdfCache() {
  const entries = await allEntries();
  let totalBytes = entries.reduce((total, entry) => total + Number(entry.size || 0), 0);
  if (totalBytes <= maxBytes()) return;
  const db = await openDb();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  for (const entry of entries.sort((a, b) => a.accessedAt - b.accessedAt)) {
    if (totalBytes <= maxBytes()) break;
    store.delete(entry.key);
    totalBytes -= entry.size;
  }
}
