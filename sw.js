const STATIC_CACHE = 'private-docs-static-v4';
const CACHEABLE_HOSTS = new Set([
    self.location.host,
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
]);

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

async function updateCachedResponse(request) {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request) {
    try {
        return await updateCachedResponse(request);
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
    }
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || request.headers.has('Authorization')) return;

    const url = new URL(request.url);
    if (!CACHEABLE_HOSTS.has(url.host) || url.hostname === 'api.github.com') return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        const refresh = updateCachedResponse(request).catch(() => null);
        if (cached) {
            event.waitUntil(refresh);
            return cached;
        }
        const response = await refresh;
        if (response) return response;
        throw new Error(`ネットワークから取得できません: ${request.url}`);
    })());
});
