// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @module userAgentMocks
 * NOTE: all functions exported are side effect only
 */

let currentUA = '';
let initialUA = '';

window.navigator = window.navigator || {};
initialUA = window.navigator.userAgent;
Object.defineProperty(window.navigator, 'userAgent', {
    get() {
        return currentUA;
    },
});

export function reset() {
    set(initialUA);
}
export function set(ua) {
    currentUA = ua;
}
export function mockSafari() {
    set('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15');
}
export function mockChrome() {
    set('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
}
