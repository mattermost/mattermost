// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getRelativeChannelURL,
    getSiteURL,
    getSiteURLFromWindowObject,
    isExternalImageBlocked,
    isExternalImageURL,
    isImageProxyURL,
    unwrapImageProxyURL,
    isPermalinkURL,
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
        test.each([
            ['same-origin file preview', 'https://chat.example.com/api/v4/files/x/preview', 'https://chat.example.com', false],
            ['relative static emoji path', '/static/emoji/1f600.png', 'https://chat.example.com', false],
            ['relative custom emoji path', '/api/v4/emoji/abc/image', 'https://chat.example.com', false],
            ['data image png URI', 'data:image/png;base64,iVBORw0KGgo=', 'https://chat.example.com', false],
            ['uppercase data image URI', 'DATA:IMAGE/PNG;base64,iVBORw0KGgo=', 'https://chat.example.com', false],
            ['data image svg URI', 'data:image/svg+xml,<svg/>', 'https://chat.example.com', false],
            ['host prefix lookalike', 'https://chat.example.com.evil.net/a.png', 'https://chat.example.com', true],
            ['scheme mismatch', 'http://chat.example.com/a.png', 'https://chat.example.com', true],
            ['non-default port mismatch', 'https://chat.example.com:8443/a.png', 'https://chat.example.com', true],
            ['default HTTPS port normalized', 'https://chat.example.com:443/a.png', 'https://chat.example.com', false],
            ['default HTTP port normalized', 'http://chat.example.com:80/a.png', 'http://chat.example.com', false],
            ['case-insensitive host', 'https://CHAT.example.com/a.png', 'https://chat.example.com', false],
            ['subpath internal file', 'https://host/mm/api/v4/files/x', 'https://host/mm', false],
            ['subpath relative internal file', '/mm/api/v4/files/x', 'https://host/mm', false],
            ['subpath outside path', 'https://host/other/a.png', 'https://host/mm', true],
            ['subpath prefix lookalike', 'https://host/mm2/a.png', 'https://host/mm', true],
            ['subpath dot-dot traversal', 'https://host/mm/../other/a.png', 'https://host/mm', true],
            ['subpath absolute image proxy URL', 'https://host/mm/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://host/mm', true],
            ['subpath relative image proxy URL', '/mm/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://host/mm', true],
            ['double-slash image proxy URL', 'https://chat.example.com//api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['subpath double-slash image proxy URL', 'https://host/mm//api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://host/mm', true],
            ['absolute image proxy URL', 'https://chat.example.com/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['relative image proxy URL', '/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['non-proxy path starting with images', 'https://chat.example.com/api/v4/images/logo.png', 'https://chat.example.com', false],
            ['empty siteURL rejects absolute URL', 'https://anything/a.png', '', true],
            ['empty siteURL allows relative URL', '/static/x.png', '', false],
            ['empty siteURL rejects relative image proxy URL', '/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', '', true],
            ['empty siteURL rejects protocol-relative URL', '//ext.example/a.png', '', true],
            ['protocol-relative external URL', '//ext.example/a.png', 'https://chat.example.com', true],
            ['protocol-relative same-host URL', '//chat.example.com/a.png', 'https://chat.example.com', true],
            ['backslash relative URL', '/\\evil.net/a.png', 'https://chat.example.com', true],
            ['backslash scheme URL', 'https:\\\\evil.net\\a.png', 'https://chat.example.com', true],
            ['tab-injected protocol-relative URL', '/\t/evil.net/a.png', 'https://chat.example.com', true],
            ['empty URL', '', 'https://chat.example.com', true],
            ['surrounding whitespace on external URL', ' https://ext/a.png ', 'https://chat.example.com', true],
            ['surrounding whitespace on relative URL', ' /static/x.png ', 'https://chat.example.com', true],
            ['javascript scheme', ['javascript', 'alert(1)'].join(':'), 'https://chat.example.com', true],
            ['blob scheme', 'blob:https://chat.example.com/x', 'https://chat.example.com', true],
            ['ftp scheme', 'ftp://chat.example.com/a.png', 'https://chat.example.com', true],
            ['non-image data URI', 'data:text/html,<script>alert(1)</script>', 'https://chat.example.com', true],
            ['URL with userinfo on same host', 'https://evil.example@chat.example.com/a.png', 'https://chat.example.com', true],
            ['same-host tab-injected URL', '/\t/chat.example.com/a.png', 'https://chat.example.com', true],
            ['same-host CR-injected URL', '/\r/chat.example.com/a.png', 'https://chat.example.com', true],
            ['same-host backslash in path', 'https://chat.example.com/a\\b.png', 'https://chat.example.com', true],
            ['percent-encoded image proxy path', 'https://chat.example.com/api/v4/%69mage?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['percent-encoded trailing slash image proxy path', 'https://chat.example.com/api/v4/image%2F?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['percent-encoded subpath traversal outside siteURL', 'https://host/mm/%2e%2e%2fother/a.png', 'https://host/mm', true],
            ['authority-less same-scheme URL', 'https:evil.com/a.png', 'https://chat.example.com', true],
        ])('%s', (_name, rawURL, siteURL, expected) => {
            expect(isExternalImageURL(rawURL, siteURL)).toBe(expected);
        });
    });

    describe('isImageProxyURL', () => {
        test.each([
            ['absolute image proxy URL', 'https://chat.example.com/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['relative image proxy URL', '/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['percent-encoded image proxy URL', 'https://chat.example.com/api/v4/%69mage?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', true],
            ['subpath absolute image proxy URL', 'https://host/mm/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://host/mm', true],
            ['subpath relative image proxy URL', '/mm/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://host/mm', true],
            ['empty siteURL relative image proxy URL', '/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', '', true],
            ['external host with proxy path', 'https://evil.net/api/v4/image?url=https%3A%2F%2Fext%2Fa.png', 'https://chat.example.com', false],
            ['regular internal file URL', 'https://chat.example.com/api/v4/files/x/preview', 'https://chat.example.com', false],
            ['non-proxy path starting with images', 'https://chat.example.com/api/v4/images/logo.png', 'https://chat.example.com', false],
            ['data image URI', 'data:image/png;base64,iVBORw0KGgo=', 'https://chat.example.com', false],
            ['empty URL', '', 'https://chat.example.com', false],
        ])('%s', (_name, rawURL, siteURL, expected) => {
            expect(isImageProxyURL(rawURL, siteURL)).toBe(expected);
        });
    });

    describe('unwrapImageProxyURL', () => {
        test.each([
            ['unwraps absolute image proxy URL', 'https://chat.example.com/api/v4/image?url=https%3A%2F%2Fext.example.com%2Fa.png', 'https://chat.example.com', 'https://ext.example.com/a.png'],
            ['unwraps relative image proxy URL', '/api/v4/image?url=https%3A%2F%2Fext.example.com%2Fa.png', 'https://chat.example.com', 'https://ext.example.com/a.png'],
            ['unwraps subpath image proxy URL', 'https://host/mm/api/v4/image?url=https%3A%2F%2Fext.example.com%2Fa.png', 'https://host/mm', 'https://ext.example.com/a.png'],
            ['keeps non-proxy URL unchanged', 'https://ext.example.com/a.png', 'https://chat.example.com', 'https://ext.example.com/a.png'],
            ['keeps proxy URL without url param unchanged', '/api/v4/image', 'https://chat.example.com', '/api/v4/image'],
            ['keeps proxy URL with unsafe target unchanged', '/api/v4/image?url=javascript%3Aalert(1)', 'https://chat.example.com', '/api/v4/image?url=javascript%3Aalert(1)'],
            ['unwraps percent-encoded image proxy URL', 'https://chat.example.com/api/v4/%69mage?url=https%3A%2F%2Fext.example.com%2Fa.png', 'https://chat.example.com', 'https://ext.example.com/a.png'],
        ])('%s', (_name, rawURL, siteURL, expected) => {
            expect(unwrapImageProxyURL(rawURL, siteURL)).toBe(expected);
        });
    });

    describe('isExternalImageBlocked', () => {
        test('blocks external URL only when BlockExternalImages is true', () => {
            expect(isExternalImageBlocked('https://ext.example/a.png', {BlockExternalImages: 'true', SiteURL: 'https://chat.example.com'})).toBe(true);
            expect(isExternalImageBlocked('https://chat.example.com/a.png', {BlockExternalImages: 'true', SiteURL: 'https://chat.example.com'})).toBe(false);
            expect(isExternalImageBlocked('https://ext.example/a.png', {BlockExternalImages: 'false', SiteURL: 'https://chat.example.com'})).toBe(false);
            expect(isExternalImageBlocked(undefined, {BlockExternalImages: 'true', SiteURL: 'https://chat.example.com'})).toBe(false);
        });
    });
});
