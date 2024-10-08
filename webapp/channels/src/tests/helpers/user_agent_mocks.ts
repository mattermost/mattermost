// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @module userAgentMocks
 * NOTE: all functions exported are side effect only
 */

let currentUA = '';
let initialUA = '';
let currentPlatform = '';
let initialPlatform = '';

window.navigator = window.navigator || {};

initialUA = window.navigator.userAgent;
initialPlatform = window.navigator.platform;

Object.defineProperty(window.navigator, 'userAgent', {
    get() {
        return currentUA;
    },
});
Object.defineProperty(window.navigator, 'platform', {
    get() {
        return currentPlatform;
    },
});

export function reset() {
    set(initialUA);
    setPlatform(initialPlatform);
}
export function set(ua: string) {
    currentUA = ua;
}
export function setPlatform(platform: string) {
    currentPlatform = platform;
}

export function mockSafari() {
    set('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15');
}
export function mockChrome() {
    set('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
}
