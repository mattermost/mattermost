// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {PageDisplayTypes} from 'utils/constants';

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
    (state: GlobalState, wikiId: string) => state.entities.wikiPages?.byWiki?.[wikiId] || [],
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
    const newValue = state.entities.wikiPages?.lastPagesInvalidated?.[wikiId];
    const oldValue = state.entities.wikiPages?.lastInvalidated?.[wikiId];
    return newValue || oldValue || 0;
};

// Get last drafts invalidation timestamp for a wiki
export const getDraftsLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.wikiPages?.lastDraftsInvalidated?.[wikiId] || 0;
};

// Get all pages from all wikis in a channel (for cross-wiki linking)
export const getChannelPages = createSelector(
    'getChannelPages',
    (state: GlobalState) => state.entities.posts.posts,
    (_state: GlobalState, channelId: string) => channelId,
    (posts, channelId) => {
        // Get all pages (type === PAGE) in this channel
        return Object.values(posts).filter((post) =>
            Boolean(post) &&
            post.type === PostTypes.PAGE &&
            post.channel_id === channelId,
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
