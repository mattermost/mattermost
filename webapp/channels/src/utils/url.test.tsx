// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getRelativeChannelURL,
    getSiteURL,
    getSiteURLFromWindowObject,
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
});

describe('Utils.URL - In-App Links', () => {
    const {isMattermostAppURL, parseMattermostLink, isUrlSafe, isInternalURL, shouldOpenInNewTab} = require('utils/url');
    
    describe('isMattermostAppURL', () => {
        test.each([
            ['mattermost://team/channels/channel', true],
            ['mattermost://team/pl/postid', true],
            ['MATTERMOST://team/channels/channel', true],
            ['http://example.com', false],
            ['https://example.com', false],
            ['javascript:alert(1)', false],
            ['', false],
        ])('isMattermostAppURL(%s) should return %s', (url, expected) => {
            expect(isMattermostAppURL(url)).toBe(expected);
        });
    });
    
    describe('isUrlSafe with mattermost:// URLs', () => {
        test('mattermost:// URLs should be safe', () => {
            expect(isUrlSafe('mattermost://team/channels/channel')).toBe(true);
        });
        
        test('dangerous schemes should not be safe', () => {
            expect(isUrlSafe('javascript:alert(1)')).toBe(false);
            expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false);
            expect(isUrlSafe('vbscript:msgbox(1)')).toBe(false);
        });
    });
    
    describe('isInternalURL with mattermost:// URLs', () => {
        test('mattermost:// URLs should be internal', () => {
            expect(isInternalURL('mattermost://team/channels/channel')).toBe(true);
        });
    });
    
    describe('shouldOpenInNewTab with mattermost:// URLs', () => {
        test('mattermost:// URLs should not open in new tab', () => {
            expect(shouldOpenInNewTab('mattermost://team/channels/channel')).toBe(false);
        });
        
        test('external URLs should open in new tab', () => {
            expect(shouldOpenInNewTab('https://external.com')).toBe(true);
        });
    });
    
    describe('parseMattermostLink', () => {
        test('parse channel link', () => {
            const result = parseMattermostLink('mattermost://myteam/channels/mychannel');
            expect(result).toEqual({
                kind: 'channel',
                team: 'myteam',
                channel: 'mychannel',
                path: '/myteam/channels/mychannel',
            });
        });
        
        test('parse permalink', () => {
            const result = parseMattermostLink('mattermost://myteam/pl/postid123');
            expect(result).toEqual({
                kind: 'permalink',
                team: 'myteam',
                postId: 'postid123',
                path: '/myteam/pl/postid123',
            });
        });
        
        test('parse DM link', () => {
            const result = parseMattermostLink('mattermost://myteam/messages/@username');
            expect(result).toEqual({
                kind: 'dm',
                team: 'myteam',
                username: '@username',
                path: '/myteam/messages/@username',
            });
        });
        
        test('return null for non-mattermost URL', () => {
            expect(parseMattermostLink('https://example.com')).toBeNull();
        });
        
        test('return null for invalid URL', () => {
            expect(parseMattermostLink('invalid')).toBeNull();
        });
        
        test('parse global route (admin_console)', () => {
            const result = parseMattermostLink('mattermost://admin_console/system_analytics');
            expect(result).toEqual({
                kind: 'global',
                path: '/admin_console/system_analytics',
            });
        });
        
        test('parse generic fallback path', () => {
            const result = parseMattermostLink('mattermost://myteam/custom/path/here');
            expect(result).toEqual({
                kind: 'generic',
                team: 'myteam',
                path: '/myteam/custom/path/here',
            });
        });
        
        test('parse team from query parameter', () => {
            const result = parseMattermostLink('mattermost://channels/town-square?team=myteam');
            expect(result).toEqual({
                kind: 'channel',
                team: 'myteam',
                channel: 'town-square',
                path: '/myteam/channels/town-square',
            });
        });
        
        test('parse DM without @ (auto-add)', () => {
            const result = parseMattermostLink('mattermost://myteam/messages/username');
            expect(result).toEqual({
                kind: 'dm',
                team: 'myteam',
                username: '@username',
                path: '/myteam/messages/@username',
            });
        });
        
        test('parse with dm alias', () => {
            const result = parseMattermostLink('mattermost://myteam/dm/@user');
            expect(result).toEqual({
                kind: 'dm',
                team: 'myteam',
                username: '@user',
                path: '/myteam/messages/@user',
            });
        });
    });
});
