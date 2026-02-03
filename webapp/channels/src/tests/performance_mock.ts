// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PerformanceObserver as NodePerformanceObserver, performance as nodePerformance} from 'node:perf_hooks';

// These aren't a perfect match for window.performance and PerformanceObserver, but they're close enough. They don't
// work with `jest.useFakeTimers` because that overwrites window.performance in a way that breaks the Node.js version.
//
// To use PerformanceObserver, you need to use a `setTimeout` or `await observations()` to have a PerformanceObserver's
// callback get called. See the accompanying tests for examples.

Object.defineProperty(window, 'performance', {
    writable: true,
    value: nodePerformance,
});

Object.defineProperty(global, 'PerformanceObserver', {
    value: NodePerformanceObserver,
});

// Only Chrome-based browsers support long task timings currently, so make Node pretend it does too
Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', {
    value: [...PerformanceObserver.supportedEntryTypes, 'longtask'],
});

export function waitForObservations() {
    // Performance observations are processed after any timeout
    return new Promise((resolve) => setTimeout(resolve));
}
