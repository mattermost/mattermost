// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getRelativeChannelURL,
    getSiteURL,
    getSiteURLFromWindowObject,
    isExternalImageURL,
    isImageProxyURL,
    isPermalinkURL,
    unwrapImageProxyURL,
    validateChannelUrl,
} from 'utils/url';

describe('Utils.URL', () => {
    test('getRelativeChannelURL', () => {
        expect(getRelativeChannelURL('teamName', 'channelName')).toEqual('/teamName/channels/channelName');
    });

    describe('getSiteURL', () => {
        const testCases = [
            {
                description: 'origin',
                location: {origin: 'http://example.com:8065', protocol: '', hostname: '', port: ''},
                basename: '',
                expectedSiteURL: 'http://example.com:8065',
            },
            {
                description: 'origin, trailing slash',
                location: {origin: 'http://example.com:8065/', protocol: '', hostname: '', port: ''},
                basename: '',
                expectedSiteURL: 'http://example.com:8065',
            },
            {
                description: 'origin, with basename',
                location: {origin: 'http://example.com:8065', protocol: '', hostname: '', port: ''},
                basename: '/subpath',
                expectedSiteURL: 'http://example.com:8065/subpath',
            },
            {
                description: 'no origin',
                location: {origin: '', protocol: 'http:', hostname: 'example.com', port: '8065'},
                basename: '',
                expectedSiteURL: 'http://example.com:8065',
            },
            {
                description: 'no origin, with basename',
                location: {origin: '', protocol: 'http:', hostname: 'example.com', port: '8065'},
                basename: '/subpath',
                expectedSiteURL: 'http://example.com:8065/subpath',
            },
        ];

        testCases.forEach((testCase) => it(testCase.description, () => {
            const obj = {
                location: testCase.location,
                basename: testCase.basename,
            };

            expect(getSiteURLFromWindowObject(obj)).toEqual(testCase.expectedSiteURL);
        }));
    });

    describe('validateChannelUrl', () => {
        const testCases = [
            {
                description: 'Called with an empty string',
                url: '',
                expectedErrors: ['change_url.longer'],
            },
            {
                description: 'Called with a url starting with a dash',
                url: '-Url',
                expectedErrors: ['change_url.startWithLetter'],
            },
            {
                description: 'Called with a url starting with an underscore',
                url: '_URL',
                expectedErrors: ['change_url.startWithLetter'],
            },
            {
                description: 'Called with a url starting and ending with an underscore',
                url: '_a_',
                expectedErrors: ['change_url.startAndEndWithLetter'],
            },
            {
                description: 'Called with a url starting and ending with an dash',
                url: '-a-',
                expectedErrors: ['change_url.startAndEndWithLetter'],
            },
            {
                description: 'Called with a url ending with an dash',
                url: 'a----',
                expectedErrors: ['change_url.endWithLetter'],
            },
            {
                description: 'Called with a url containing two underscores',
                url: 'foo__bar',
                expectedErrors: [],
            },
            {
                description: 'Called with a url resembling a direct message url',
                url: 'uzsfmtmniifsjgesce4u7yznyh__uzsfmtmniifsjgesce4u7yznyh',
                expectedErrors: ['change_url.invalidDirectMessage'],
            },
            {
                description: 'Called with a containing two dashes',
                url: 'foo--bar',
                expectedErrors: [],
            },
            {
                description: 'Called with a capital letters two dashes',
                url: 'Foo--bar',
                expectedErrors: ['change_url.invalidUrl'],
            },
        ];

        testCases.forEach((testCase) => it(testCase.description, () => {
            const returnedErrors = validateChannelUrl(testCase.url).map((error) => (typeof error === 'string' ? error : error.key));
            returnedErrors.sort();
            testCase.expectedErrors.sort();
            expect(returnedErrors).toEqual(testCase.expectedErrors);
        }));
    });

    describe('isPermalinkURL', () => {
        const siteURL = getSiteURL();
        test.each([
            ['/teamname-1/pl/affe2344234', true],
            [`${siteURL}/teamname-1/pl/affe2344234`, true],
            [siteURL, false],
            ['/teamname-1/channel/post', false],
            ['https://example.com', false],
            ['https://example.com/teamname-1/pl/affe2344234', false],
        ])('is permalink for %s should return %s', (url, expected) => {
            expect(isPermalinkURL(url)).toBe(expected);
        });
    });

    describe('isExternalImageURL', () => {
        const rootSite = 'https://chat.example.com';
        const subpathSite = 'https://chat.example.com/mm';

        test.each([
            ['', rootSite, false],
            ['data:image/png;base64,iVBORw0KGgo=', rootSite, false],
            ['/api/v4/files/abc123/preview', rootSite, false],
            ['https://chat.example.com/static/logo.png', rootSite, false],
            ['https://chat.example.com:443/static/logo.png', rootSite, false],
            ['HTTPS://CHAT.EXAMPLE.COM/static/logo.png', rootSite, false],
            ['https://external.example/a.png', rootSite, true],
            ['https://chat.example.com.evil.net/a.png', rootSite, true],
            ['http://chat.example.com/static/logo.png', rootSite, true],
            ['https://chat.example.com:8443/static/logo.png', rootSite, true],
            ['//external.example/a.png', rootSite, true],
            ['/\\evil.net/a.png', rootSite, true],
            // eslint-disable-next-line no-script-url
            ['javascript:alert(1)', rootSite, true],
            ['/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', rootSite, true],
            ['/api/v4/%69mage?url=https%3A%2F%2Fexternal.example%2Fa.png', rootSite, true],
            ['https://chat.example.com//api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', rootSite, true],
            ['/mm//api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', subpathSite, true],
            ['https://chat.example.com/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', rootSite, true],
            ['https://chat.example.com/mm/api/v4/files/1/preview', subpathSite, false],
            ['static/logo.png', subpathSite, false],
            ['https://chat.example.com/mm2/a.png', subpathSite, true],
            ['https://chat.example.com/mm/../other/a.png', subpathSite, true],
            ['https://chat.example.com/mm/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', subpathSite, true],
            ['/mm/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', subpathSite, true],
            ['https://user@chat.example.com/a.png', rootSite, true],
            [' https://chat.example.com/static/logo.png', rootSite, true],
            ['blob:https://chat.example.com/1234-5678', rootSite, true],
            ['https://chat.example.com/static/100%logo.png', rootSite, false],
            ['https://chat.example.com/a.png', '', true],
            ['/api/v4/files/1/preview', '', false],
            ['/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png', '', true],
        ])('isExternalImageURL(%s, %s) -> %s', (rawURL, sURL, expected) => {
            expect(isExternalImageURL(rawURL, sURL)).toBe(expected);
        });
    });

    describe('isImageProxyURL and unwrapImageProxyURL', () => {
        const siteURL = 'https://chat.example.com';

        test('recognizes proxy URLs on root and subpath including percent-encoded path', () => {
            expect(isImageProxyURL('/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(true);
            expect(isImageProxyURL('/api/v4/%69mage?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(true);
            expect(isImageProxyURL('https://chat.example.com/mm/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com/mm')).toBe(true);
            expect(isImageProxyURL('api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com/mm')).toBe(true);
            expect(isImageProxyURL('https://other.example/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(false);
            expect(isImageProxyURL('https://user@chat.example.com/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(false);
            expect(isImageProxyURL(' /api/v4/image?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(false);
            expect(isImageProxyURL('https://chat.example.com/api/v4/image/%ZZ?url=https%3A%2F%2Fext%2Fa.png', siteURL)).toBe(true);
            expect(isImageProxyURL('blob:https://chat.example.com/api/v4/image', siteURL)).toBe(false);
        });

        test('unwraps safe external URLs and rejects unsafe schemes', () => {
            expect(unwrapImageProxyURL('/api/v4/image?url=https%3A%2F%2Fext.example%2Fa.png', siteURL)).toBe('https://ext.example/a.png');
            expect(unwrapImageProxyURL('/api/v4/%69mage?url=https%3A%2F%2Fext.example%2Fa.png', siteURL)).toBe('https://ext.example/a.png');
            const unsafe = '/api/v4/image?url=javascript%3Aalert(1)';
            expect(unwrapImageProxyURL(unsafe, siteURL)).toBe(unsafe);
        });
    });
});
