// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This is a temporary store while we are transitioning from Flux to Redux. This file exports
// the configured Redux store for use by actions and selectors.

import type {Store} from 'redux';

import type {GlobalState} from 'types/store';

// The store is initialized by entry.tsx using dynamic imports to break circular dependencies.
// This module provides access to the store via a proxy that reads from window.__MM_STORE__.
//
// With Vite/Rollup's module bundling, circular dependencies can cause
// "Cannot access before initialization" errors when modules are initialized
// in a different order than webpack would. The solution is to:
// 1. Have entry.tsx initialize the store FIRST using dynamic import
// 2. Store it on window.__MM_STORE__
// 3. Have this module read from window instead of importing store configuration

function getStore(): Store<GlobalState> {
    // eslint-disable-next-line no-underscore-dangle
    const windowStore = (window as any).__MM_STORE__;
    if (!windowStore) {
        throw new Error(
            'Redux store not initialized. Ensure the app entry point initializes the store before accessing it.',
        );
    }
    return windowStore;
}

// Cache for bound functions to ensure stable references across accesses.
// This is critical for React hooks like useDispatch() which depend on stable references.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, func-call-spacing, no-spaced-func
const boundFunctionCache = new Map<string | symbol, (...args: any[]) => any>();

// Create a proxy that reads from window.__MM_STORE__ on each access
const store = new Proxy({} as Store<GlobalState>, {
    get(_target, prop: string | symbol) {
        const realStore = getStore();
        const value = (realStore as any)[prop];
        if (typeof value === 'function') {
            // Return cached bound function to maintain referential equality
            if (!boundFunctionCache.has(prop)) {
                boundFunctionCache.set(prop, value.bind(realStore));
            }
            return boundFunctionCache.get(prop);
        }
        return value;
    },
});

export default store;
