// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {isPageBookmark, parsePageUrl, buildPageUrl} from './bookmark_utils';

describe('isPageBookmark', () => {
    it('returns true when URL is a page link', () => {
        const bookmark = {link_url: '/myteam/wiki/chan123/wiki456/page789'} as ChannelBookmark;
        expect(isPageBookmark(bookmark)).toBe(true);
    });

    it('returns false when URL is external link', () => {
        const bookmark = {link_url: 'https://example.com'} as ChannelBookmark;
        expect(isPageBookmark(bookmark)).toBe(false);
    });

    it('returns false when link_url is undefined', () => {
        const bookmark = {} as ChannelBookmark;
        expect(isPageBookmark(bookmark)).toBe(false);
    });
});

describe('parsePageUrl', () => {
    it('extracts all components from page URL', () => {
        const result = parsePageUrl('/myteam/wiki/chan123/wiki456/page789');
        expect(result).toEqual({
            teamName: 'myteam',
            channelId: 'chan123',
            wikiId: 'wiki456',
            pageId: 'page789',
        });
    });

    it('returns null for non-page URL', () => {
        expect(parsePageUrl('https://example.com')).toBeNull();
    });

    it('returns null for incomplete page URL', () => {
        expect(parsePageUrl('/myteam/wiki/chan123')).toBeNull();
    });
});

describe('buildPageUrl', () => {
    it('builds correct URL', () => {
        const url = buildPageUrl('myteam', 'chan123', 'wiki456', 'page789');
        expect(url).toBe('/myteam/wiki/chan123/wiki456/page789');
    });

    it('roundtrip parsing works', () => {
        const originalTeam = 'myteam';
        const originalChannel = 'chan123';
        const originalWiki = 'wiki456';
        const originalPage = 'page789';

        const url = buildPageUrl(originalTeam, originalChannel, originalWiki, originalPage);
        const result = parsePageUrl(url);

        expect(result).not.toBeNull();
        expect(result?.teamName).toBe(originalTeam);
        expect(result?.channelId).toBe(originalChannel);
        expect(result?.wikiId).toBe(originalWiki);
        expect(result?.pageId).toBe(originalPage);
    });
});
