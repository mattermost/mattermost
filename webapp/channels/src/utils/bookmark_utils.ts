// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {getWikiUrl} from 'utils/url';

const PAGE_URL_PATTERN = /^\/([^/?]+)\/wiki\/([^/?]+)\/([^/?]+)(?:\?.*)?$/;

export function isPageBookmark(bookmark: ChannelBookmark): boolean {
    return PAGE_URL_PATTERN.test(bookmark.link_url || '');
}

export function parsePageUrl(url: string): {teamName: string; wikiId: string; pageId: string} | null {
    const match = url.match(PAGE_URL_PATTERN);
    if (!match) {
        return null;
    }

    return {
        teamName: match[1],
        wikiId: match[2],
        pageId: match[3],
    };
}

export function buildPageUrl(teamName: string, wikiId: string, pageId: string): string {
    return getWikiUrl(teamName, wikiId, pageId, false);
}
