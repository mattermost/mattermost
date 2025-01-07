// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('Service Worker', () => {
    let sw;

    beforeEach(() => {
        // Mock the ServiceWorker global scope
        global.caches = {
            open: jest.fn(() => Promise.resolve({
                put: jest.fn(),
            })),
            match: jest.fn(),
            keys: jest.fn(),
            delete: jest.fn(),
        };
        global.fetch = jest.fn();

        // Import the service worker fresh for each test
        jest.isolateModules(() => {
            sw = require('./sw.js');
        });
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('putInCache', () => {
        it('should store HTML documents under HTML_REQUEST key', async () => {
            const cache = {put: jest.fn()};
            global.self.caches.open.mockResolvedValue(cache);

            const request = {destination: 'document'};
            const response = {clone: () => response};

            await sw.putInCache(request, response);

            expect(global.self.caches.open).toHaveBeenCalledWith(sw.cacheName);
            expect(cache.put).toHaveBeenCalledWith(sw.HTML_REQUEST, response);
        });

        it('should store non-HTML requests under their own key', async () => {
            const cache = {put: jest.fn()};
            global.self.caches.open.mockResolvedValue(cache);

            const request = {destination: 'image'};
            const response = {clone: () => response};

            await sw.putInCache(request, response);

            expect(global.self.caches.open).toHaveBeenCalledWith(sw.cacheName);
            expect(cache.put).toHaveBeenCalledWith(request, response);
        });
    });

    describe('handleCacheRequest', () => {
        it('should return cached response if available', async () => {
            const cachedResponse = {clone: () => cachedResponse};
            global.self.caches.match.mockResolvedValue(cachedResponse);

            const networkResponse = {clone: () => networkResponse};
            global.fetch.mockResolvedValue(networkResponse);

            const request = {destination: 'style', clone: () => request};
            const result = await sw.handleCacheRequest(request);

            expect(result).toBe(cachedResponse);
        });

        it('should fetch from network if cache miss', async () => {
            global.self.caches.match.mockResolvedValue(null);

            const networkResponse = {clone: () => networkResponse};
            global.fetch.mockResolvedValue(networkResponse);

            const request = {destination: 'style', clone: () => request};
            const result = await sw.handleCacheRequest(request);

            expect(result).toBe(networkResponse);
        });
    });

    describe('deleteOldCaches', () => {
        it('should delete all caches except current version', async () => {
            global.self.caches.keys.mockResolvedValue([sw.cacheName, 'v0', 'old-cache']);

            await sw.deleteOldCaches();

            expect(global.self.caches.delete).not.toHaveBeenCalledWith(sw.cacheName);
            expect(global.self.caches.delete).toHaveBeenCalledWith('v0');
            expect(global.self.caches.delete).toHaveBeenCalledWith('old-cache');
        });
    });
});
