// Techzen Chat - Service Worker
// PWA offline support với Cache-First strategy cho assets, Network-First cho API
// Version: 1.0.0

const CACHE_VERSION = 'techzen-chat-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/offline.html',
];

// Cache strategies
const STATIC_PATTERNS = [
    /\/static\//,      // JS, CSS, images
    /\/images\//,
    /\.(js|css|png|jpg|svg|woff2|woff|ttf)$/,
];

const API_PATTERNS = [
    /\/api\/v4\//,
];

// =====================
// Install: Pre-cache critical assets
// =====================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                // Don't fail install if precache fails
                console.warn('[SW] Precache warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// =====================
// Activate: Clean old caches
// =====================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('techzen-chat-') && name !== STATIC_CACHE && name !== API_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// =====================
// Fetch: Route requests
// =====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests
    if (url.origin !== self.location.origin) return;

    // API: Network-first, cache as fallback (5s timeout)
    if (API_PATTERNS.some((p) => p.test(url.pathname))) {
        event.respondWith(networkFirstWithTimeout(request, API_CACHE, 5000));
        return;
    }

    // Static assets: Cache-first (30 days)
    if (STATIC_PATTERNS.some((p) => p.test(url.pathname) || p.test(url.href))) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Navigation requests: Network-first, offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(navigateWithOfflineFallback(request));
        return;
    }

    // Default: network only
    event.respondWith(fetch(request));
});

// =====================
// Strategy: Cache-First
// =====================
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        // Refresh cache in background (stale-while-revalidate)
        fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
        }).catch(() => { });
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Asset not available offline', { status: 503 });
    }
}

// =====================
// Strategy: Network-First với timeout
// =====================
async function networkFirstWithTimeout(request, cacheName, timeout) {
    const cache = await caches.open(cacheName);

    const networkPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
    );

    try {
        return await Promise.race([networkPromise, timeoutPromise]);
    } catch {
        const cached = await cache.match(request);
        return cached || new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// =====================
// Strategy: Navigate với offline fallback
// =====================
async function navigateWithOfflineFallback(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match('/offline.html');
        return offline || new Response('<h1>Offline</h1>', {
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

// =====================
// Push Notifications (future VAPID integration)
// =====================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || '',
        icon: '/static/images/favicon/android-chrome-192x192.png',
        badge: '/static/images/favicon/favicon-32x32.png',
        tag: data.tag || 'techzen-notification',
        data: { url: data.url || '/' },
        requireInteraction: false,
        silent: false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Techzen Chat', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
