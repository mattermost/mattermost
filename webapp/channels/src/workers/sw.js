// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Update this every time code is changed.
// This is needed to delete old cache entries.
const cacheName = 'v1';
const HTML_REQUEST = new Request('root.html');

const putInCache = async (request, response) => {
    const cache = await caches.open(cacheName);
    if (request.destination === 'document') {
        await cache.put(HTML_REQUEST, response);
    } else {
        await cache.put(request, response);
    }
};

const handleCacheRequest = async (request) => {
    // Using the stale-while-revalidate approach for cached requests to keep them in sync.
    let responseFromCache;
    if (request.destination === 'document') {
        // If it's an HTML document, then we check for a separate key.
        responseFromCache = await caches.match(HTML_REQUEST);
    } else {
        responseFromCache = await caches.match(request);
    }
    if (responseFromCache) {
        // Non-blocking cache insertion.
        fetchFromNetwork(request);
        return responseFromCache;
    }

    // Wait till we get a response.
    const responseFromNetwork = await fetchFromNetwork(request);
    return responseFromNetwork;
};

const fetchFromNetwork = async (request) => {
    try {
        const responseFromNetwork = await fetch(request.clone());
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`error while fetching from sw: ${error}`);

        // return a Response object if network request fails.
        return new Response('Network error happened', {
            status: 408,
            headers: {'Content-Type': 'text/plain'},
        });
    }
};

const precachedAssets = [
    '/',
    '/static/css/initial_loading_screen.css',
    '/static/images/favicon/favicon-default-16x16.png',
    '/static/images/favicon/favicon-default-24x24.png',
    '/static/images/favicon/favicon-default-32x32.png',
    '/static/images/favicon/favicon-default-64x64.png',
    '/static/images/favicon/favicon-default-96x96.png',
];

self.addEventListener('fetch', (event) => {
    // https://issues.chromium.org/issues/40895772
    // Chrome doesn't support preloadResponse, so we leave it for now.

    const url = new URL(event.request.url);
    const isPrecachedRequest = precachedAssets.includes(url.pathname);
    const isDocumentRequest = event.request.destination === 'document';
    const isFontRequest = event.request.destination === 'font';

    // We need the event.request.destination == 'document' condition
    // to match other URLs which return the same root.html.
    // Also cache font requests to reduce janky re-render.
    if (isPrecachedRequest || isDocumentRequest || isFontRequest) {
        event.respondWith(handleCacheRequest(event.request));
    }
});

const deleteCache = async (key) => {
    await caches.delete(key);
};

const deleteOldCaches = async () => {
    const keyList = await caches.keys();
    const cachesToDelete = keyList.filter((key) => key !== cacheName);
    await Promise.all(cachesToDelete.map(deleteCache));
};

self.addEventListener('activate', (event) => {
    event.waitUntil(deleteOldCaches());
});

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = {
        putInCache,
        handleCacheRequest,
        deleteOldCaches,
        cacheName,
        HTML_REQUEST,
    };
}
