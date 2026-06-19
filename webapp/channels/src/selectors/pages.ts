// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, SelectPropertyField} from '@mattermost/types/properties';
import type {BreadcrumbPath, Page, Wiki} from '@mattermost/types/wikis';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getPageById} from 'mattermost-redux/selectors/entities/pages';
import {getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';

import {PagePropsKeys} from 'utils/constants';
import {isDraftPageId} from 'utils/page_utils';
import {getWikiUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

export const getPage = getPageById;

export const getPageAncestors = createSelector(
    'getPageAncestors',
    (state: GlobalState) => state.entities.pages.byId,
    (_state: GlobalState, pageId: string) => pageId,
    (pages, pageId) => {
        const ancestors: Page[] = [];
        let currentPage = pages[pageId];
        const visited = new Set<string>();

        while (currentPage?.parent_id) {
            const parentId = currentPage.parent_id;

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

// makeGetPages returns a per-component memoized selector for a single wikiId.
// Each component instance creates its own selector so concurrent wiki views
// don't thrash each other's cache (single shared createSelector with a variable
// wikiId parameter only caches the last-called argument).
export const makeGetPages = () => createSelector(
    'makeGetPages',
    (state: GlobalState) => state.entities.pages.byId,
    (state: GlobalState, wikiId: string) => state.entities.pages.byWiki[wikiId] || [],
    (pages, pageIds) => {
        return pageIds.
            map((id) => pages[id]).
            filter((page): page is Page => Boolean(page) && (page.type === 'page' || page.type === 'page_folder') && page.state !== 'DELETED');
    },
);

// makeGetPublishedPages returns a per-component memoized selector for published pages in a wiki.
export const makeGetPublishedPages = () => createSelector(
    'makeGetPublishedPages',
    (state: GlobalState) => state.entities.pages.byId,
    (state: GlobalState, wikiId: string) => state.entities.pages.byWiki[wikiId] || [],
    (pages, pageIds) => {
        return pageIds.
            map((id) => pages[id]).
            filter((page): page is Page => Boolean(page) && (page.type === 'page' || page.type === 'page_folder') && page.state !== 'DELETED').
            filter((page) => !isDraftPageId(page.id));
    },
);

export const arePagesLoaded = (state: GlobalState, wikiId: string): boolean => {
    return wikiId in state.entities.pages.byWiki;
};

export const getPagesLoading = (state: GlobalState, wikiId: string): boolean => {
    return state.requests.wiki?.loading?.[wikiId] || false;
};

export const getPagesError = (state: GlobalState, wikiId: string): string | null => {
    return state.requests.wiki?.error?.[wikiId] || null;
};

export const getPagesLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.pages.lastPagesInvalidated?.[wikiId] || 0;
};

export const getDraftsLastInvalidated = (state: GlobalState, wikiId: string): number => {
    return state.entities.pages.lastDraftsInvalidated?.[wikiId] || 0;
};

// Reads byId filtered by channel_id — fetchChannelPages populates byId without updating byWiki.
// Factory: each component instance creates its own selector so concurrent channel views
// don't thrash each other's memoization cache (a single shared selector only caches the last argument).
export const makeGetChannelPages = () => createSelector(
    'getChannelPages',
    (state: GlobalState) => state.entities.pages.byId,
    (_state: GlobalState, channelId: string) => channelId,
    (pages) => {
        // Channel-scoped filtering: pages no longer have a channel_id field.
        // Return all pages from byId for now; callers should use wiki-scoped selectors.
        return Object.values(pages).filter(
            (page): page is Page => Boolean(page) && (page.type === 'page' || page.type === 'page_folder') && page.state !== 'DELETED',
        );
    },
);

export const getWiki = (state: GlobalState, wikiId: string) => {
    return state.entities.wikis?.byId?.[wikiId];
};

// Returns the earliest-linked channel the user is a member of, or '' if none.
// Uses channel membership, not URL context. Not for permission checks.
export const getResolvedChannelId = createSelector(
    'getResolvedChannelId',
    (state: GlobalState, wikiId: string) => getWiki(state, wikiId),
    (state: GlobalState) => state.entities.wikis?.linksByChannel,
    (state: GlobalState) => state.entities.channels?.myMembers,
    (wiki, linksByChannel, myMembers): string => {
        if (!wiki?.id || !linksByChannel) {
            return '';
        }

        type Match = {channelId: string; createAt: number};
        const matches: Match[] = [];
        for (const [channelId, links] of Object.entries(linksByChannel)) {
            if (!links || !Array.isArray(links)) {
                continue;
            }
            if (myMembers && !myMembers[channelId]) {
                continue;
            }
            for (const link of links) {
                if (link.wiki_id === wiki.id) {
                    matches.push({channelId, createAt: link.create_at || 0});
                    break;
                }
            }
        }

        if (matches.length === 0) {
            return '';
        }

        return [...matches].sort((a, b) => (a.createAt - b.createAt) || a.channelId.localeCompare(b.channelId))[0].channelId;
    },
);

// A wiki appears in a channel iff there is a ChannelMemberLink from that channel to the wiki.
// Use makeGetChannelWikis() to get a per-component instance with its own memoization slot.
export const makeGetChannelWikis = () => createSelector(
    'getChannelWikis',
    (state: GlobalState) => state.entities.wikis?.byId,
    (state: GlobalState) => state.entities.wikis?.linksByChannel,
    (_state: GlobalState, channelId: string) => channelId,
    (wikisById, linksByChannel, channelId) => {
        if (!channelId || !wikisById) {
            return [];
        }
        const links = linksByChannel?.[channelId];
        if (!links || links.length === 0) {
            return [];
        }

        const out: Wiki[] = [];
        const seen = new Set<string>();
        for (const link of links) {
            const wiki = wikisById[link.wiki_id];
            if (wiki && !seen.has(wiki.id)) {
                out.push(wiki);
                seen.add(wiki.id);
            }
        }
        return out;
    },
);

export const getPageStatusField = createSelector(
    'getPageStatusField',
    (state: GlobalState) => getPropertyGroupByName(state, 'pages'),
    (state: GlobalState) => state.entities.properties.fields.byObjectType.page,
    (pagesGroup, byObjectType) => {
        if (!pagesGroup || !byObjectType) {
            return null;
        }
        const fieldsInGroup = byObjectType[pagesGroup.id] as Record<string, PropertyField> | undefined;
        if (!fieldsInGroup) {
            return null;
        }
        const found = Object.values(fieldsInGroup).find((f) => f.name === 'status');
        return (found?.type === 'select' ? found as SelectPropertyField : null) ?? null;
    },
);

export const getPageStatus = (state: GlobalState, postId: string): string => {
    const page = getPage(state, postId);
    return (page?.properties?.[PagePropsKeys.PAGE_STATUS] as string) || '';
};

export const makeBreadcrumbSelector = () => createSelector(
    'buildBreadcrumbFromRedux',
    (state: GlobalState, wikiId: string) => getWiki(state, wikiId),
    (state: GlobalState, _wikiId: string, pageId: string) => getPage(state, pageId),
    (state: GlobalState, _wikiId: string, pageId: string) => getPageAncestors(state, pageId),
    (_state: GlobalState, wikiId: string) => wikiId,
    (_state: GlobalState, _wikiId: string, _pageId: string, teamName: string) => teamName,
    (wiki, page, ancestors, wikiId, teamName): BreadcrumbPath | null => {
        if (!wiki || !page) {
            return null;
        }

        const items: BreadcrumbPath['items'] = [];

        items.push({
            id: wikiId,
            title: wiki.title,
            type: 'wiki',
            path: getWikiUrl(teamName, wikiId),
        });

        for (const ancestor of ancestors) {
            items.push({
                id: ancestor.id,
                title: ancestor.title || 'Untitled',
                type: 'page',
                path: getWikiUrl(teamName, wikiId, ancestor.id),
            });
        }

        return {
            items,
            current_page: {
                id: page.id,
                title: page.title || 'Untitled',
                type: 'page',
                path: getWikiUrl(teamName, wikiId, page.id),
            },
        };
    },
);

