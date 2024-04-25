// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PerformanceObserver, performance} from 'node:perf_hooks';

// These aren't a perfect match for window.performance and PerformanceObserver, but they're close enough. They don't
// work with `jest.useFakeTimers` because that overwrites window.performance in a way that breaks the Node.js version.
//
// To use PerformanceObserver, you need to use a `setTimeout` or `await observations()` to have a PerformanceObserver's
// callback get called. See the accompanying tests for examples.
//
// Also, as of the time of writing this, calling an observer's `observe` method with `buffered: true` doesn't call
// the callback for entries entries from before it was called, unlike how a browser's `PerformanceObserver` works.

export function initializePerformanceMocks() {
    Object.defineProperty(window, 'performance', {
        writable: true,
        value: performance,
    });

    Object.defineProperty(global, 'PerformanceObserver', {
        value: PerformanceObserver,
    });
}

export function waitForObservations() {
    // Performance observations are processed after any timeout
    return new Promise((resolve) => setTimeout(resolve));
}
