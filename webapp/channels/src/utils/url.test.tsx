// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getRelativeChannelURL,
    getSiteURL,
    getSiteURLFromWindowObject,
    isPermalinkURL,
    validateChannelUrl,
    isUrlSafe,
    isInternalURL,
    shouldOpenInNewTab,
    isValidUrl,
    validHttpUrl,
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

    describe('isUrlSafe', () => {
        test.each([
            ['https://example.com', true],
            ['http://example.com', true],
            ['javascript:alert(1)', false],
            ['data:text/html,<script>alert(1)</script>', false],
            ['mattermost://channel/team-name/channel-name', true],
            ['mattermost://user/user-id', true],
        ])('isUrlSafe for %s should return %s', (url, expected) => {
            expect(isUrlSafe(url)).toBe(expected);
        });
    });

    describe('isInternalURL', () => {
        const siteURL = getSiteURL();
        test.each([
            [`${siteURL}/teamname-1/pl/affe2344234`, true],
            ['/teamname-1/pl/affe2344234', true],
            ['https://example.com', false],
            ['mattermost://channel/team-name/channel-name', true],
            ['mattermost://user/user-id', true],
        ])('isInternalURL for %s should return %s', (url, expected) => {
            expect(isInternalURL(url)).toBe(expected);
        });
    });

    describe('shouldOpenInNewTab', () => {
        const siteURL = getSiteURL();
        test.each([
            [`${siteURL}/teamname-1/pl/affe2344234`, false],
            ['/teamname-1/pl/affe2344234', false],
            ['https://example.com', true],
            ['mattermost://channel/team-name/channel-name', false],
            ['mattermost://user/user-id', false],
        ])('shouldOpenInNewTab for %s should return %s', (url, expected) => {
            expect(shouldOpenInNewTab(url)).toBe(expected);
        });
    });

    describe('isValidUrl', () => {
        test.each([
            ['https://example.com', true],
            ['http://example.com', true],
            ['ftp://example.com', false],
            ['javascript:alert(1)', false],
            ['mattermost://channel/team-name/channel-name', true],
            ['mattermost://user/user-id', true],
        ])('isValidUrl for %s should return %s', (url, expected) => {
            expect(isValidUrl(url)).toBe(expected);
        });
    });

    describe('validHttpUrl', () => {
        test.each([
            ['https://example.com', true],
            ['http://example.com', true],
            ['ftp://example.com', false],
            ['javascript:alert(1)', false],
            ['mattermost://channel/team-name/channel-name', true],
            ['mattermost://user/user-id', true],
            ['mattermost://invalid url format', false],
        ])('validHttpUrl for %s should return %s', (url, expected) => {
            const result = validHttpUrl(url);
            expect(result !== null).toBe(expected);
        });
    });
});