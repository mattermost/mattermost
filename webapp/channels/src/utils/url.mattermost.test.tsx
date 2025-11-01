// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseMattermostLink, isMattermostAppURL} from './url';

describe('utils/url parseMattermostLink', () => {
    test('detects mattermost scheme', () => {
        expect(isMattermostAppURL('mattermost://foo/channels/bar')).toBe(true);
        expect(isMattermostAppURL('http://foo')).toBe(false);
    });

    test('parses channel links with team as host', () => {
        const t = parseMattermostLink('mattermost://team-1/channels/town-square');
        expect(t).toEqual({
            kind: 'channel',
            team: 'team-1',
            channel: 'town-square',
            path: '/team-1/channels/town-square',
        });
    });

    test('parses permalinks with team as host', () => {
        const postId = '12345678901234567890123456';
        const t = parseMattermostLink(`mattermost://team-1/pl/${postId}`);
        expect(t).toEqual({
            kind: 'permalink',
            team: 'team-1',
            postId,
            path: `/team-1/pl/${postId}`,
        });
    });

    test('parses DM links with @username', () => {
        const t = parseMattermostLink('mattermost://team-1/messages/@john');
        expect(t).toEqual({
            kind: 'dm',
            team: 'team-1',
            username: '@john',
            path: '/team-1/messages/@john',
        });
    });

    test('parses DM links without @ prefix', () => {
        const t = parseMattermostLink('mattermost://team-1/messages/jane');
        expect(t).toEqual({
            kind: 'dm',
            team: 'team-1',
            username: '@jane',
            path: '/team-1/messages/@jane',
        });
    });

    test('infers team from first path segment when host is empty', () => {
        const t = parseMattermostLink('mattermost:///team-1/channels/off-topic');
        expect(t).toEqual({
            kind: 'channel',
            team: 'team-1',
            channel: 'off-topic',
            path: '/team-1/channels/off-topic',
        });
    });

    test('uses ?team query parameter when host is empty', () => {
        const t = parseMattermostLink('mattermost:///channels/random?team=team-1');
        expect(t).toEqual({
            kind: 'channel',
            team: 'team-1',
            channel: 'random',
            path: '/team-1/channels/random',
        });
    });

    test('handles global routes without team', () => {
        const t = parseMattermostLink('mattermost:///admin_console/site_config');
        expect(t).toEqual({
            kind: 'global',
            path: '/admin_console/site_config',
        });
    });

    test('falls back to generic mapping when unknown path', () => {
        const t = parseMattermostLink('mattermost://team-1/some/custom/path');
        expect(t).toEqual({
            kind: 'generic',
            team: 'team-1',
            path: '/team-1/some/custom/path',
        });
    });

    test('returns null on non-mattermost scheme', () => {
        expect(parseMattermostLink('https://example.com')).toBeNull();
    });
});
