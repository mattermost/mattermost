// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getBrowserInfo, getPlatformInfo} from './browser_info';

describe('utils/browser_info', () => {
    const originalNavigator = window.navigator;

    beforeEach(() => {
        // Create a mock navigator object
        Object.defineProperty(window, 'navigator', {
            value: {
                userAgent: '',
                platform: '',
            },
            writable: true,
        });
    });

    afterEach(() => {
        // Restore the original navigator
        Object.defineProperty(window, 'navigator', {
            value: originalNavigator,
            writable: true,
        });
    });

    describe('getBrowserInfo', () => {
        const browserTestCases = [
            {
                name: 'Mattermost Desktop App',
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.83 Electron/34.0.1 Safari/537.36 Mattermost/34.0.1',
                expectedBrowser: 'Mattermost Desktop App',
                expectedVersion: '34.0.1',
            },
            {
                name: 'Edge (Legacy)',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edge/42.0',
                expectedBrowser: 'Edge',
                expectedVersion: '42',
            },
            {
                name: 'Edge Chromium',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edg/92.0.234.1',
                expectedBrowser: 'Edge Chromium',
                expectedVersion: '92',
            },
            {
                name: 'Chrome',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/92.0.4515.131',
                expectedBrowser: 'Chrome',
                expectedVersion: '92',
            },
            {
                name: 'Opera',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/92.0.4515.131 OPR/77.0.4054.277',
                expectedBrowser: 'Opera',
                expectedVersion: '77',
            },
            {
                name: 'Safari',
                userAgent: 'Mozilla/5.0 (Macintosh) Version/14.1 Safari/605.1.15',
                expectedBrowser: 'Safari',
                expectedVersion: '14',
            },
            {
                name: 'Firefox',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/90.0',
                expectedBrowser: 'Firefox',
                expectedVersion: '90',
            },
            {
                name: 'Unknown Browser',
                userAgent: 'Some Unknown Browser',
                expectedBrowser: 'Unknown',
                expectedVersion: 'Unknown',
            },
        ];

        test.each(browserTestCases)(
            'should detect $name',
            ({userAgent, expectedBrowser, expectedVersion}) => {
                // @ts-expect-error we can override the userAgent in tests
                window.navigator.userAgent = userAgent;
                const {browser, browserVersion} = getBrowserInfo();
                expect(browser).toBe(expectedBrowser);
                expect(browserVersion).toBe(expectedVersion);
            },
        );
    });

    describe('getPlatformInfo', () => {
        const platformTestCases = [
            {
                name: 'Windows using platform',
                platform: 'Win32',
                userAgent: '',
                expectedPlatform: 'Windows',
            },
            {
                name: 'MacOS using platform',
                platform: 'MacIntel',
                userAgent: '',
                expectedPlatform: 'MacOS',
            },
            {
                name: 'Linux using platform',
                platform: 'Linux x86_64',
                userAgent: '',
                expectedPlatform: 'Linux',
            },
            {
                name: 'Windows using userAgent',
                platform: '',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
                expectedPlatform: 'Windows',
            },
            {
                name: 'MacOS using userAgent',
                platform: '',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                expectedPlatform: 'MacOS',
            },
            {
                name: 'Linux using userAgent',
                platform: '',
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
                expectedPlatform: 'Linux',
            },
            {
                name: 'Unknown Platform',
                platform: '',
                userAgent: 'Some Unknown Platform',
                expectedPlatform: 'Unknown',
            },
        ];

        test.each(platformTestCases)(
            'should detect $name',
            ({platform, userAgent, expectedPlatform}) => {
                // @ts-expect-error we can override the platform in tests
                window.navigator.platform = platform;

                // @ts-expect-error we can override the userAgent in tests
                window.navigator.userAgent = userAgent;
                expect(getPlatformInfo()).toBe(expectedPlatform);
            },
        );
    });
});
