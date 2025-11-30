// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, act} from '@testing-library/react';
import React from 'react';

import Constants, {WindowSizes} from 'utils/constants';

import MobileViewWatcher from './mobile_view_watcher';

// Custom matchMedia mock for vitest
type MediaQueryListener = (e: MediaQueryListEvent) => void;

interface MockMediaQueryList {
    matches: boolean;
    media: string;
    onchange: null | MediaQueryListener;
    addListener: (listener: MediaQueryListener) => void;
    removeListener: (listener: MediaQueryListener) => void;
    addEventListener: (type: string, listener: MediaQueryListener) => void;
    removeEventListener: (type: string, listener: MediaQueryListener) => void;
    dispatchEvent: (event: Event) => boolean;
}

const mediaQueryLists: Map<string, MockMediaQueryList> = new Map();
let listeners: Map<string, MediaQueryListener[]> = new Map();

const createMediaQueryList = (query: string, matches: boolean = false): MockMediaQueryList => {
    const mql: MockMediaQueryList = {
        matches,
        media: query,
        onchange: null,
        addListener: (cb) => {
            const existing = listeners.get(query) || [];
            existing.push(cb);
            listeners.set(query, existing);
        },
        removeListener: (cb) => {
            const existing = listeners.get(query) || [];
            listeners.set(query, existing.filter((l) => l !== cb));
        },
        addEventListener: (_, cb) => {
            const existing = listeners.get(query) || [];
            existing.push(cb);
            listeners.set(query, existing);
        },
        removeEventListener: (_, cb) => {
            const existing = listeners.get(query) || [];
            listeners.set(query, existing.filter((l) => l !== cb));
        },
        dispatchEvent: () => true,
    };
    mediaQueryLists.set(query, mql);
    return mql;
};

const triggerMediaQuery = (query: string) => {
    // Set all queries to not match first
    mediaQueryLists.forEach((mql) => {
        mql.matches = false;
    });

    // Set the target query to match
    const mql = mediaQueryLists.get(query);
    if (mql) {
        mql.matches = true;
        const queryListeners = listeners.get(query) || [];
        queryListeners.forEach((listener) => {
            listener({matches: true, media: query} as MediaQueryListEvent);
        });
    }
};

const clearMocks = () => {
    mediaQueryLists.clear();
    listeners = new Map();
};

describe('window.matchMedia', () => {
    const originalMatchMedia = window.matchMedia;

    beforeAll(() => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => {
            return createMediaQueryList(query);
        });
    });

    afterAll(() => {
        window.matchMedia = originalMatchMedia;
    });

    afterEach(() => {
        clearMocks();
        vi.clearAllMocks();
    });

    test('should update redux when the desktop media query matches', () => {
        const emitBrowserWindowResized = vi.fn();
        render(<MobileViewWatcher emitBrowserWindowResized={emitBrowserWindowResized}/>);

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(0);

        act(() => {
            triggerMediaQuery(`(min-width: ${Constants.DESKTOP_SCREEN_WIDTH + 1}px)`);
        });

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(1);
        expect(emitBrowserWindowResized).toHaveBeenCalledWith(WindowSizes.DESKTOP_VIEW);
    });

    test('should update redux when the small desktop media query matches', () => {
        const emitBrowserWindowResized = vi.fn();
        render(<MobileViewWatcher emitBrowserWindowResized={emitBrowserWindowResized}/>);

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(0);

        act(() => {
            triggerMediaQuery(`(min-width: ${Constants.TABLET_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.DESKTOP_SCREEN_WIDTH}px)`);
        });

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(1);
        expect(emitBrowserWindowResized).toHaveBeenCalledWith(WindowSizes.SMALL_DESKTOP_VIEW);
    });

    test('should update redux when the tablet media query matches', () => {
        const emitBrowserWindowResized = vi.fn();
        render(<MobileViewWatcher emitBrowserWindowResized={emitBrowserWindowResized}/>);

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(0);

        act(() => {
            triggerMediaQuery(`(min-width: ${Constants.MOBILE_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.TABLET_SCREEN_WIDTH}px)`);
        });

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(1);
        expect(emitBrowserWindowResized).toHaveBeenCalledWith(WindowSizes.TABLET_VIEW);
    });

    test('should update redux when the mobile media query matches', () => {
        const emitBrowserWindowResized = vi.fn();
        render(<MobileViewWatcher emitBrowserWindowResized={emitBrowserWindowResized}/>);

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(0);

        act(() => {
            triggerMediaQuery(`(max-width: ${Constants.MOBILE_SCREEN_WIDTH}px)`);
        });

        expect(emitBrowserWindowResized).toHaveBeenCalledTimes(1);
        expect(emitBrowserWindowResized).toHaveBeenCalledWith(WindowSizes.MOBILE_VIEW);
    });
});
