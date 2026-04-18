// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {BreadcrumbPath} from '@mattermost/types/wikis';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {PagePropsKeys} from 'utils/constants';
import {isDraftPageId} from 'utils/page_utils';
import {getPageTitle} from 'utils/post_utils';
import {getWikiUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

// Get single page. Canonical implementation lives in mattermost-redux; re-exported
// here as `getPage` so webapp components can import from a single selectors module.
export const getPage = getPageById;

// Get page ancestors for breadcrumb
export const getPageAncestors = createSelector(
    'getPageAncestors',
    (state: GlobalState) => state.entities.pages.byId,
    (_state: GlobalState, pageId: string) => pageId,
    (pages, pageId) => {
        const ancestors: Post[] = [];
        let currentPage = pages[pageId];
        const visited = new Set<string>();

        // Walk up the parent chain using page_parent_id
        while (currentPage?.page_parent_id) {
            const parentId = currentPage.page_parent_id;

            // Prevent infinite loops from circular references
            if (visited.has(parentId)) {
                break;
            }

            const parent = pages[parentId];
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
    (state: GlobalState) => state.entities.pages.byId,
    (state: GlobalState, wikiId: string) => state.entities.pages.byWiki[wikiId] || [],
    (pages, pageIds) => {
        return pageIds.
            map((id) => pages[id]).
            filter((post) => Boolean(post) && post.type === PostTypes.PAGE && post.state !== 'DELETED');
    },
);

// Get published pages for a wiki (excludes draft pages)
// Draft pages have IDs starting with 'draft-'
export const getPublishedPages = createSelector(
    'getPublishedPages',
    getPages,
    (pages) => {
        return pages.filter((page) => !isDraftPageId(page.id));
    },
);

// Check if pages have been loaded for a wiki (byWiki has an entry, even if empty)
export const arePagesLoaded = (state: GlobalState, wikiId: string): boolean => {
    return wikiId in state.entities.pages.byWiki;
};

// Get loading state for a wiki (from requests reducer)
export const getPagesLoading = (state: GlobalState, wikiId: string): boolean => {
    return state.requests.wiki?.loading?.[wikiId] || false;
};

// Get error state for a wiki (from requests reducer)
export const getPagesError = (state: GlobalState, wikiId: string): string | null => {
    return state.requests.wiki?.error?.[wikiId] || null;
};

// Get last pages invalidation timestamp for a wiki
export const getPagesLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.pages.lastPagesInvalidated?.[wikiId] || 0;
};

// Get last drafts invalidation timestamp for a wiki
export const getDraftsLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.pages.lastDraftsInvalidated?.[wikiId] || 0;
};

// Get all pages from all wikis in a channel (for cross-wiki linking).
// Reads directly from byId filtered by channel_id — fetchChannelPages populates byId
// without updating byWiki, so we scan byId here instead of using the byWiki index.
export const getChannelPages = createSelector(
    'getChannelPages',
    (state: GlobalState) => state.entities.pages.byId,
    (_state: GlobalState, channelId: string) => channelId,
    (pages, channelId) => {
        return Object.values(pages).filter(
            (page): page is Post => Boolean(page) && page.type === PostTypes.PAGE && page.channel_id === channelId,
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
// TODO(boards-integration): migrate getPageStatusField to read from entities.properties.fields.byObjectType["post"]["wikis"]
export const getPageStatusField = (state: GlobalState) => {
    return state.entities.wikiPages ?? null;
};

// Get status for a specific page
export const getPageStatus = (state: GlobalState, postId: string): string => {
    const page = getPage(state, postId);
    return (page?.props?.[PagePropsKeys.PAGE_STATUS] as string) || 'In progress';
};

// Memoized selector for breadcrumb path from Redux state (no API call needed)
export const makeBreadcrumbSelector = () => createSelector(
    'buildBreadcrumbFromRedux',
    (state: GlobalState, wikiId: string) => getWiki(state, wikiId),
    (state: GlobalState, _wikiId: string, pageId: string) => getPage(state, pageId),
    (state: GlobalState, _wikiId: string, pageId: string) => getPageAncestors(state, pageId),
    (_state: GlobalState, wikiId: string) => wikiId,
    (_state: GlobalState, _wikiId: string, _pageId: string, channelId: string) => channelId,
    (_state: GlobalState, _wikiId: string, _pageId: string, _channelId: string, teamName: string) => teamName,
    (wiki, page, ancestors, wikiId, channelId, teamName): BreadcrumbPath | null => {
        if (!wiki || !page) {
            return null;
        }

        const items: BreadcrumbPath['items'] = [];

        // Add wiki as root
        items.push({
            id: wikiId,
            title: wiki.title,
            type: 'wiki',
            path: getWikiUrl(teamName, channelId, wikiId),
            channel_id: channelId,
        });

        // Add ancestor pages
        for (const ancestor of ancestors) {
            items.push({
                id: ancestor.id,
                title: getPageTitle(ancestor),
                type: 'page',
                path: getWikiUrl(teamName, channelId, wikiId, ancestor.id),
                channel_id: channelId,
            });
        }

        return {
            items,
            current_page: {
                id: page.id,
                title: getPageTitle(page),
                type: 'page',
                path: getWikiUrl(teamName, channelId, wikiId, page.id),
                channel_id: channelId,
            },
        };
    },
);

// Legacy function for backwards compatibility - prefer makeBreadcrumbSelector for memoization
export const buildBreadcrumbFromRedux = (
    state: GlobalState,
    wikiId: string,
    pageId: string,
    channelId: string,
    teamName: string,
): BreadcrumbPath | null => {
    const selector = makeBreadcrumbSelector();
    return selector(state, wikiId, pageId, channelId, teamName);
};
