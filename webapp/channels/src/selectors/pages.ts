// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {BreadcrumbItem, BreadcrumbPath} from '@mattermost/types/wikis';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {PageDisplayTypes} from 'utils/constants';
import {getWikiUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

// Suppress unused variable warning - PageDisplayTypes is used in comments and future code
export {PageDisplayTypes};

// Get single page
export const getPage = (state: GlobalState, pageId: string): Post | undefined => {
    return state.entities.posts.posts[pageId];
};

// Get page ancestors for breadcrumb
export const getPageAncestors = createSelector(
    'getPageAncestors',
    (state: GlobalState) => state.entities.posts.posts,
    (_state: GlobalState, pageId: string) => pageId,
    (posts, pageId) => {
        const ancestors: Post[] = [];
        let currentPage = posts[pageId];
        const visited = new Set<string>();

        // Walk up the parent chain using page_parent_id
        while (currentPage?.page_parent_id) {
            const parentId = currentPage.page_parent_id;

            // Prevent infinite loops from circular references
            if (visited.has(parentId)) {
                break;
            }

            const parent = posts[parentId];
            if (parent) {
                ancestors.unshift(parent);
                visited.add(parentId);
                currentPage = parent;
            } else {
                break;
            }
        }

        return ancestors;
    },
);

// Get all pages for a wiki (for hierarchy panel)
// Filters out pages marked as deleted (post.state === 'DELETED')
export const getPages = createSelector(
    'getPages',
    (state: GlobalState) => state.entities.posts.posts,
    (state: GlobalState, wikiId: string) => {
        const byWiki = state.entities.wikiPages?.byWiki || {};
        return byWiki[wikiId] || [];
    },
    (posts, pageIds) => {
        return pageIds.
            map((id) => posts[id]).
            filter((post) => Boolean(post) && post.type === PostTypes.PAGE && post.state !== 'DELETED');
    },
);

// Get loading state for a wiki
export const getPagesLoading = (state: GlobalState, wikiId: string): boolean => {
    return state.entities.wikiPages?.loading?.[wikiId] || false;
};

// Get error state for a wiki
export const getPagesError = (state: GlobalState, wikiId: string): string | null => {
    return state.entities.wikiPages?.error?.[wikiId] || null;
};

// Get last pages invalidation timestamp for a wiki
export const getPagesLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.wikiPages?.lastPagesInvalidated?.[wikiId] || 0;
};

// Get last drafts invalidation timestamp for a wiki
export const getDraftsLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.wikiPages?.lastDraftsInvalidated?.[wikiId] || 0;
};

// Get all pages from all wikis in a channel (for cross-wiki linking)
// Uses existing indexes (wikis.byChannel + wikiPages.byWiki) for O(1) lookup
// instead of iterating all posts O(n)
export const getChannelPages = createSelector(
    'getChannelPages',
    (state: GlobalState) => state.entities.posts.posts,
    (state: GlobalState) => state.entities.wikis?.byChannel,
    (state: GlobalState) => state.entities.wikiPages?.byWiki,
    (_state: GlobalState, channelId: string) => channelId,
    (posts, wikisByChannel, pagesByWiki, channelId) => {
        const wikiIds = wikisByChannel?.[channelId] || [];
        const pageIds = wikiIds.flatMap((wikiId) => pagesByWiki?.[wikiId] || []);
        return pageIds.
            map((id) => posts[id]).
            filter((post): post is Post =>
                Boolean(post) &&
                post.type === PostTypes.PAGE &&
                post.state !== 'DELETED',
            );
    },
);

// Wiki selectors
export const getWiki = (state: GlobalState, wikiId: string) => {
    return state.entities.wikis?.byId?.[wikiId];
};

// Memoized selector for channel wikis
export const getChannelWikis = createSelector(
    'getChannelWikis',
    (state: GlobalState) => state.entities.wikis?.byId,
    (_state: GlobalState, channelId: string) => _state.entities.wikis?.byChannel?.[channelId],
    (wikisById, wikiIds) => {
        if (!wikisById || !wikiIds) {
            return [];
        }
        return wikiIds.map((id: string) => wikisById[id]).filter(Boolean);
    },
);

// Get page status field definition
export const getPageStatusField = (state: GlobalState) => {
    return (state.entities.wikiPages as any)?.statusField;
};

// Get status for a specific page
export const getPageStatus = (state: GlobalState, postId: string): string => {
    const page = getPage(state, postId);
    return (page?.props?.page_status as string) || 'In progress';
};

// Build breadcrumb from Redux state (no API call)
export const buildBreadcrumbFromRedux = (
    state: GlobalState,
    wikiId: string,
    pageId: string,
    channelId: string,
    teamName: string,
): BreadcrumbPath | null => {
    const wiki = state.entities.wikis?.byId?.[wikiId];
    if (!wiki) {
        return null;
    }

    const page = getPage(state, pageId);
    if (!page) {
        return null;
    }

    const ancestors = getPageAncestors(state, pageId);
    const items: BreadcrumbItem[] = [
        {
            id: wikiId,
            title: wiki.title,
            type: 'wiki',
            path: getWikiUrl(teamName, channelId, wikiId),
            channel_id: channelId,
        },
    ];

    ancestors.forEach((ancestor) => {
        items.push({
            id: ancestor.id,
            title: (ancestor.props?.title as string) || 'Untitled',
            type: 'page',
            path: getWikiUrl(teamName, channelId, wikiId, ancestor.id),
            channel_id: channelId,
        });
    });

    return {
        items,
        current_page: {
            id: page.id,
            title: (page.props?.title as string) || 'Untitled',
            type: 'page',
            path: getWikiUrl(teamName, channelId, wikiId, page.id),
            channel_id: channelId,
        },
    };
};
