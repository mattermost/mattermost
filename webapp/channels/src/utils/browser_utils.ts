// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Wrapper for window.location.reload to make it mockable in tests.
 * In jest-environment-jsdom 30+ (jsdom 25+), window.location.reload
 * cannot be directly mocked. Using this wrapper allows tests to mock
 * the behavior.
 */
export function reloadPage(): void {
    window.location.reload();
}
