// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {getWikiUrl} from 'utils/url';

// URL pattern: /:team/wiki/:channelId/:wikiId/:pageId
const PAGE_URL_PATTERN = /^\/([^/]+)\/wiki\/([^/]+)\/([^/]+)\/([^/]+)$/;

export function isPageBookmark(bookmark: ChannelBookmark): boolean {
    return PAGE_URL_PATTERN.test(bookmark.link_url || '');
}

export function parsePageUrl(url: string): {teamName: string; channelId: string; wikiId: string; pageId: string} | null {
    const match = url.match(PAGE_URL_PATTERN);
    if (!match) {
        return null;
    }

    return {
        teamName: match[1],
        channelId: match[2],
        wikiId: match[3],
        pageId: match[4],
    };
}

export function buildPageUrl(teamName: string, channelId: string, wikiId: string, pageId: string): string {
    return getWikiUrl(teamName, channelId, wikiId, pageId);
}
