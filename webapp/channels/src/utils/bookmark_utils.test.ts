// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {isPageBookmark, parsePageUrl, buildPageUrl} from './bookmark_utils';

describe('isPageBookmark', () => {
    it('returns true when URL is a page link', () => {
        const bookmark = {link_url: '/myteam/wiki/wiki456/page789'} as ChannelBookmark;
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
        const result = parsePageUrl('/myteam/wiki/wiki456/page789');
        expect(result).toEqual({
            teamName: 'myteam',
            wikiId: 'wiki456',
            pageId: 'page789',
        });
    });

    it('tolerates legacy ?from= query param without parsing it', () => {
        const result = parsePageUrl('/myteam/wiki/wiki456/page789?from=channel123');
        expect(result).toEqual({
            teamName: 'myteam',
            wikiId: 'wiki456',
            pageId: 'page789',
        });
    });

    it('returns null for non-page URL', () => {
        expect(parsePageUrl('https://example.com')).toBeNull();
    });

    it('returns null for incomplete page URL', () => {
        expect(parsePageUrl('/myteam/wiki/wiki456')).toBeNull();
    });
});

describe('buildPageUrl', () => {
    it('builds correct URL', () => {
        const url = buildPageUrl('myteam', 'wiki456', 'page789');
        expect(url).toBe('/myteam/wiki/wiki456/page789');
    });

    it('roundtrip with parsePageUrl', () => {
        const url = buildPageUrl('myteam', 'wiki456', 'page789');
        const result = parsePageUrl(url);

        expect(result).not.toBeNull();
        expect(result?.teamName).toBe('myteam');
        expect(result?.wikiId).toBe('wiki456');
        expect(result?.pageId).toBe('page789');
    });
});
