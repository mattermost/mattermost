// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type Listener = (event: Pick<MediaQueryListEvent, 'matches' | 'media'>) => void;

const listenersByQuery = new Map<string, Set<Listener>>();
let currentMediaQuery = '';

function addListener(query: string, listener: Listener) {
    const listeners = listenersByQuery.get(query) ?? new Set();
    listeners.add(listener);
    listenersByQuery.set(query, listeners);
}

function removeListener(query: string, listener: Listener) {
    listenersByQuery.get(query)?.delete(listener);
}

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
        get matches() {
            return query === currentMediaQuery;
        },
        media: query,
        onchange: null,
        addListener: (listener: Listener) => addListener(query, listener),
        removeListener: (listener: Listener) => removeListener(query, listener),
        addEventListener: (type: string, listener: Listener) => {
            if (type === 'change') {
                addListener(query, listener);
            }
        },
        removeEventListener: (type: string, listener: Listener) => {
            if (type === 'change') {
                removeListener(query, listener);
            }
        },
        dispatchEvent: () => false,
    }),
});

const matchMedia = {
    useMediaQuery(query: string) {
        currentMediaQuery = query;
        listenersByQuery.get(query)?.forEach((listener) => listener({matches: true, media: query}));
    },

    clear() {
        listenersByQuery.clear();
        currentMediaQuery = '';
    },
};

export default matchMedia;
