// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

// Use vi.hoisted to set up Observable BEFORE any imports are evaluated
// This prevents the "Observable is not defined" error from localforage-observable
vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const Observable = require('zen-observable');

    // Set up Observable globally for localforage-observable
    (globalThis as any).Observable = Observable;
    if (typeof window !== 'undefined') {
        (window as any).Observable = Observable;
    }
});

// Mock localforage-observable to prevent initialization errors in tests
// The extendPrototype function adds observable methods to localforage instance
vi.mock('localforage-observable', () => ({
    extendPrototype: (localforage: any) => {
        // Add mocked observable methods to the localforage instance
        // without replacing the original methods
        localforage.configObservables = vi.fn();
        localforage.newObservable = vi.fn(() => ({
            subscribe: vi.fn(),
        }));
        return localforage;
    },
}));
