// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {reset as resetNavigator, setPlatform, set as setUserAgent} from 'tests/helpers/user_agent_mocks';

import {getPlatformLabel, getUserAgentLabel} from './platform_detection';

describe('getUserAgentLabel and getPlatformLabel', () => {
    afterEach(() => {
        resetNavigator();
    });

    const testCases = [
        {
            description: 'Desktop app on Windows',
            input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.156 Electron/29.3.0 Safari/537.36 Mattermost/5.9.0-develop.1',
            expectedAgent: 'desktop',
            expectedPlatform: 'windows',
        },
        {
            description: 'Desktop app on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.276 Electron/28.2.2 Safari/537.36 Mattermost/5.7.0',
            expectedAgent: 'desktop',
            expectedPlatform: 'macos',
        },
        {
            description: 'Desktop app on Linux',
            input: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.156 Electron/29.3.0 Safari/537.36 Mattermost/5.9.0-develop.1',
            expectedAgent: 'desktop',
            expectedPlatform: 'linux',
        },
        {
            description: 'Chrome on Windows',
            input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            expectedAgent: 'chrome',
            expectedPlatform: 'windows',
        },
        {
            description: 'Chrome on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            expectedAgent: 'chrome',
            expectedPlatform: 'macos',
        },
        {
            description: 'Chrome on Linux',
            input: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            expectedAgent: 'chrome',
            expectedPlatform: 'linux',
        },
        {
            description: 'Chrome on iPhone',
            input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
            expectedAgent: 'chrome',
            expectedPlatform: 'ios',
        },
        {
            description: 'Chrome on iPad',
            input: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
            expectedAgent: 'chrome',
            expectedPlatform: 'ios',
        },
        {
            description: 'Chrome on Android',
            input: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36',
            expectedAgent: 'chrome',
            expectedPlatform: 'android',
        },
        {
            description: 'Firefox on Windows',
            input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'windows',
        },
        {
            description: 'Firefox on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'macos',
        },
        {
            description: 'Firefox on Linux 1',
            input: 'Mozilla/5.0 (X11; Linux i686; rv:125.0) Gecko/20100101 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Firefox on Linux 2',
            input: 'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:125.0) Gecko/20100101 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Firefox on Linux 3',
            input: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Firefox on iPhone',
            input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
            expectedAgent: 'firefox',
            expectedPlatform: 'ios',
        },
        {
            description: 'Firefox on iPad',
            input: 'Mozilla/5.0 (iPad; CPU OS 14_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
            expectedAgent: 'firefox',
            expectedPlatform: 'ios',
        },
        {
            description: 'Firefox on Android 1',
            input: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'android',
        },
        {
            description: 'Firefox on Android 2',
            input: 'Mozilla/5.0 (Android 14; Mobile; LG-M255; rv:125.0) Gecko/125.0 Firefox/125.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'android',
        },
        {
            description: 'Firefox ESR on Windows',
            input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'windows',
        },
        {
            description: 'Firefox ESR on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:115.0) Gecko/20100101 Firefox/115.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'macos',
        },
        {
            description: 'Firefox ESR on Linux 1',
            input: 'Mozilla/5.0 (Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Firefox ESR on Linux 2',
            input: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Firefox ESR on Linux 3',
            input: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0',
            expectedAgent: 'firefox',
            expectedPlatform: 'linux',
        },
        {
            description: 'Safari on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
            expectedAgent: 'safari',
            expectedPlatform: 'macos',
        },
        {
            description: 'Safari on iPhone',
            input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
            expectedAgent: 'safari',
            expectedPlatform: 'ios',
        },
        {
            description: 'Safari on iPad',
            input: 'Mozilla/5.0 (iPad; CPU OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
            expectedAgent: 'safari',
            expectedPlatform: 'ios',
        },
        {
            description: 'Edge on Windows',
            input: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
            expectedAgent: 'edge',
            expectedPlatform: 'windows',
        },
        {
            description: 'Edge on Mac',
            input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
            expectedAgent: 'edge',
            expectedPlatform: 'macos',
        },
        {
            description: 'Edge on iPhone',
            input: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.2478.71 Mobile/15E148 Safari/605.1.15',
            expectedAgent: 'edge',
            expectedPlatform: 'ios',
        },
        {
            description: 'Edge on Android 1',
            input: 'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36 EdgA/124.0.2478.62',
            expectedAgent: 'edge',
            expectedPlatform: 'android',
        },
        {
            description: 'Edge on Android 2',
            input: 'Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36 EdgA/124.0.2478.62',
            expectedAgent: 'edge',
            expectedPlatform: 'android',
        },
        {
            description: 'Edge on Android 3',
            input: 'Mozilla/5.0 (Linux; Android 10; ONEPLUS A6003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36 EdgA/124.0.2478.62',
            expectedAgent: 'edge',
            expectedPlatform: 'android',
        },
    ];

    for (const testCase of testCases) {
        test('should detect user agent and platform for ' + testCase.description, () => {
            setUserAgent(testCase.input);

            if (testCase.expectedPlatform === 'linux') {
                setPlatform('Linux x86_64');
            }

            expect(getUserAgentLabel()).toEqual(testCase.expectedAgent);
            expect(getPlatformLabel()).toEqual(testCase.expectedPlatform);
        });
    }
});
