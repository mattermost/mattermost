// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllPosts} from 'mattermost-redux/selectors/entities/posts';

import {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Suppress unused variable warning - PageDisplayTypes is used in comments and future code
export {PageDisplayTypes};

// Get all pages for a channel
export const getChannelPages = createSelector(
    'getChannelPages',
    getAllPosts,
    (_state: GlobalState, channelId: string) => channelId,
    (posts, channelId) => {
        return Object.values(posts).filter(
            (post: Post) => post.channel_id === channelId && post.type === PostTypes.PAGE,
        );
    },
);

// Get single page
export const getPage = (state: GlobalState, pageId: string): Post | undefined => {
    return state.entities.posts.posts[pageId];
};

// Get full page with content from wiki store
export const getFullPage = (state: GlobalState, pageId: string): Post | undefined => {
    return state.entities.wikiPages.fullPages[pageId];
};

// Get page ancestors for breadcrumb
export const getPageAncestors = createSelector(
    'getPageAncestors',
    getAllPosts,
    (_state: GlobalState, pageId: string) => pageId,
    (posts, pageId) => {
        const ancestors: Post[] = [];
        let currentPage = posts[pageId];

        // Walk up the parent chain using page_parent_id
        while (currentPage?.page_parent_id) {
            const parentId = currentPage.page_parent_id;
            const parent = posts[parentId];
            if (parent) {
                ancestors.unshift(parent);
                currentPage = parent;
            } else {
                break;
            }
        }

        return ancestors;
    },
);

// Get child pages for a given page from full posts (when needed)
export const getPageChildrenFromPosts = createSelector(
    'getPageChildrenFromPosts',
    getAllPosts,
    (_state: GlobalState, pageId: string) => pageId,
    (posts, pageId) => {
        return Object.values(posts).filter(
            (post: Post) => post.page_parent_id === pageId,
        );
    },
);

// Get all pages for a wiki (for hierarchy panel) - returns page summaries without content
export const getWikiPages = createSelector(
    'getWikiPages',
    (state: GlobalState) => state.entities.wikiPages.pageSummaries,
    (state: GlobalState, wikiId: string) => state.entities.wikiPages.byWiki[wikiId] || [],
    (pageSummaries, pageIds) => {
        return pageIds.
            map((id) => pageSummaries[id]).
            filter((summary) => Boolean(summary) && summary.type === PostTypes.PAGE);
    },
);

// Get loading state for a wiki
export const getWikiPagesLoading = (state: GlobalState, wikiId: string): boolean => {
    return state.entities.wikiPages.loading[wikiId] || false;
};

// Get error state for a wiki
export const getWikiPagesError = (state: GlobalState, wikiId: string): string | null => {
    return state.entities.wikiPages.error[wikiId] || null;
};
