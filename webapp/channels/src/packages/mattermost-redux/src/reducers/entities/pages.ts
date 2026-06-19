// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {Page} from '@mattermost/types/wikis';

import {SearchTypes, UserTypes, WikiTypes} from 'mattermost-redux/action_types';
import {PagePropsKeys} from 'mattermost-redux/constants/pages';
import {PostTypes} from 'mattermost-redux/constants/posts';

function shouldReplacePage(existing: Page | undefined, incoming: Page, isRevert = false): boolean {
    if (!existing) {
        return true;
    }

    // Don't let a stale incoming page overwrite a locally-deleted tombstone.
    // Mirrors the posts reducer's soft-delete pattern. Intentional reverts (optimistic
    // delete rollback) set isRevert=true to bypass this guard and restore the page.
    if (existing.state === 'DELETED' && !isRevert) {
        return false;
    }

    // Optimistic pending entries (pending-*) are always replaced by server responses.
    if (existing.id.startsWith('pending-')) {
        return true;
    }

    // Use edit_at (server-assigned on write) for freshness. Optimistic updates
    // constructed client-side do not carry edit_at, so server responses naturally
    // win. Falling back to update_at would mix client Date.now() values with
    // server timestamps and drop real server updates on clock skew.
    const incomingEditAt = incoming.edit_at || 0;
    const existingEditAt = existing.edit_at || 0;

    // Existing has no edit_at: it's an optimistic entry — server response always wins.
    if (existingEditAt === 0) {
        return true;
    }

    // Incoming has no edit_at: it's an unedited page; there's no ordering to enforce,
    // so accept it. Can't drop a fresher optimistic update here because the
    // existingEditAt===0 case above already returned.
    if (incomingEditAt === 0) {
        return true;
    }

    return incomingEditAt >= existingEditAt;
}

// When list endpoints (getPages / getChannelPages) return page stubs without the
// TipTap content, preserve any non-empty body already in state so navigating
// away and back doesn't drop loaded content. Used only by RECEIVED_PAGES (bulk
// list responses); RECEIVED_PAGE trusts the server's per-page response so a
// deliberate content-clear by the user is not overwritten by stale local state.
function mergePreservedBody(existing: Page | undefined, incoming: Page): Page {
    if (!existing) {
        return incoming;
    }
    const incomingHasContent = incoming.body && incoming.body.trim() !== '';
    const existingHasContent = existing.body && existing.body.trim() !== '';
    if (!incomingHasContent && existingHasContent) {
        return {...incoming, body: existing.body};
    }
    return incoming;
}

// searchPostToPage maps a Post-shaped page search hit (Body in message, title/wiki_id in
// props) to the Page shape. It layers over any existing entry so structural fields the
// search result does not carry (parent_id, sort_order, properties) are preserved.
function searchPostToPage(post: Post, existing: Page | undefined): Page {
    const props = post.props ?? {};
    const defaults: Page = {
        id: post.id,
        wiki_id: '',
        parent_id: '',
        type: 'page',
        title: '',
        body: '',
        search_text: '',
        user_id: '',
        last_modified_by: '',
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        edit_at: 0,
        delete_at: 0,
        original_id: '',
        has_effective_view_restriction: false,
        has_local_edit_restriction: false,
        properties: {},
        pending_file_ids: [],
    };

    // Spreading `existing` (possibly undefined) preserves structural fields the search hit lacks.
    const base: Page = {...defaults, ...existing};
    return {
        ...base,
        id: post.id,
        type: 'page',
        user_id: post.user_id || base.user_id,
        wiki_id: (props.wiki_id as string) || base.wiki_id,
        title: (props.title as string) || base.title,
        body: post.message || base.body,
        create_at: post.create_at || base.create_at,
        update_at: post.update_at || base.update_at,
        edit_at: post.edit_at || base.edit_at,
    };
}

function byId(state: Record<string, Page> = {}, action: AnyAction): Record<string, Page> {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGE: {
        const {page, pendingPageId, isRevert} = action.data;
        if (!page || !page.id) {
            return state;
        }

        // Always freshness-check the real-id entry, even when replacing a pending
        // optimistic entry. A WS event may have already written a newer server
        // version to state[page.id] before this dispatch arrives; without this
        // guard we would clobber the fresher data.
        const shouldReplace = shouldReplacePage(state[page.id], page, isRevert);

        if (pendingPageId && pendingPageId !== page.id && state[pendingPageId]) {
            const nextState = {...state};
            delete nextState[pendingPageId];
            if (shouldReplace) {
                nextState[page.id] = page;
            }
            return nextState;
        }

        if (!shouldReplace) {
            return state;
        }

        return {
            ...state,
            [page.id]: page,
        };
    }
    case WikiTypes.RECEIVED_PAGES: {
        const {pages} = action.data;
        if (!pages || pages.length === 0) {
            return state;
        }
        let nextState = state;
        pages.forEach((page: Page) => {
            if (page && page.id && shouldReplacePage(nextState[page.id], page)) {
                if (nextState === state) {
                    nextState = {...state};
                }
                nextState[page.id] = mergePreservedBody(nextState[page.id], page);
            }
        });
        return nextState;
    }
    case SearchTypes.RECEIVED_SEARCH_POSTS: {
        // Page search hits come back Post-shaped (SqlPostStore.search maps Body->Message and
        // puts title/wiki_id in Props). Normalize each to the Page shape, layered over any
        // existing entry, so a search never clobbers structural fields (parent_id, sort_order,
        // properties) that the post-shaped hit does not carry.
        const posts: Record<string, Post> = action.data?.posts ?? {};
        let nextState = state;
        Object.values(posts).forEach((post: Post) => {
            if (post?.type !== PostTypes.PAGE || !post.id) {
                return;
            }
            const normalized = searchPostToPage(post, nextState[post.id]);
            if (shouldReplacePage(nextState[post.id], normalized)) {
                if (nextState === state) {
                    nextState = {...state};
                }
                nextState[post.id] = mergePreservedBody(nextState[post.id], normalized);
            }
        });
        return nextState;
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId} = action.data;
        if (!pageId) {
            return state;
        }

        // Soft-delete: mark state='DELETED' rather than removing the entry.
        // This tombstone prevents late PAGE_PUBLISHED WebSocket events from
        // re-animating the page (shouldReplacePage rejects incoming live pages
        // that would overwrite a deleted entry). Mirrors the posts reducer pattern.
        const existing = state[pageId];
        if (existing?.state === 'DELETED') {
            return state;
        }
        const tombstone = existing ?
            {...existing, state: 'DELETED'} :
            {id: pageId, state: 'DELETED', type: 'page'} as unknown as Page;
        return {...state, [pageId]: tombstone};
    }
    case WikiTypes.DELETED_WIKI:
        // Pages are kept in byId but unreferenced once removed from byWiki (see byWiki reducer).
        // Selectors filter based on byWiki index, so deletion from byId is unnecessary.
        return state;
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function byWiki(state: Record<string, string[]> = {}, action: AnyAction): Record<string, string[]> {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGES: {
        const {wikiId, pages} = action.data;
        if (!wikiId) {
            return state;
        }

        const fetchedPageIds = (pages || []).
            map((p: Page) => p?.id).
            filter((id: string | undefined): id is string => Boolean(id));
        const currentPageIds = state[wikiId] || [];
        const fetchedSet = new Set<string>(fetchedPageIds);

        // Preserve pages added via WebSocket during an in-flight fetch, but drop
        // pending-* optimistic ids (the fetch result contains their real ids and
        // keeping them would leave ghost pending rows). Limitation: we cannot
        // distinguish "added during fetch" from "deleted after fetch started" —
        // both appear as present-in-state-and-missing-from-fetch. The WS race is
        // the common case; the stale delete case is rare and self-corrects on
        // the next invalidation refetch.
        const pagesAddedDuringFetch = currentPageIds.filter(
            (id) => id && !id.startsWith('pending-') && !fetchedSet.has(id),
        );

        // Dedupe final list to guard against duplicate server ids (HA race).
        const mergedPageIds = Array.from(new Set([...fetchedPageIds, ...pagesAddedDuringFetch]));

        return {
            ...state,
            [wikiId]: mergedPageIds,
        };
    }
    case WikiTypes.RECEIVED_PAGE: {
        const {page, wikiId, pendingPageId} = action.data;

        // Match the byId guard: reject null page or missing id.
        if (!page || !page.id) {
            return state;
        }

        // When wikiId is absent, byId handles it; byWiki skips the membership update.
        if (!wikiId) {
            return state;
        }

        const currentPageIds = state[wikiId] || [];

        if (pendingPageId) {
            const pendingIndex = currentPageIds.indexOf(pendingPageId);
            if (pendingIndex !== -1) {
                // Replace pending ID with real ID at the same position.
                return {
                    ...state,
                    [wikiId]: [
                        ...currentPageIds.slice(0, pendingIndex).filter((id) => id !== page.id),
                        page.id,
                        ...currentPageIds.slice(pendingIndex + 1).filter((id) => id !== pendingPageId && id !== page.id),
                    ],
                };
            }

            // Pending entry not found — server response arrived before pending was
            // recorded (or after another resolver removed it). Fall through to plain insert.
        }

        if (currentPageIds.includes(page.id)) {
            return state;
        }
        return {
            ...state,
            [wikiId]: [...currentPageIds, page.id],
        };
    }
    case WikiTypes.REMOVED_PAGE_FROM_WIKI: {
        const {pageId, wikiId} = action.data;

        const currentPages = state[wikiId];
        if (!currentPages) {
            return state;
        }

        return {
            ...state,
            [wikiId]: currentPages.filter((id) => id !== pageId),
        };
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId, wikiId} = action.data;

        if (wikiId) {
            const currentPages = state[wikiId];
            if (!currentPages) {
                return state;
            }

            return {
                ...state,
                [wikiId]: currentPages.filter((id) => id !== pageId),
            };
        }

        const nextByWiki = {...state};
        Object.keys(nextByWiki).forEach((wiki) => {
            nextByWiki[wiki] = nextByWiki[wiki].filter((id) => id !== pageId);
        });

        return nextByWiki;
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextByWiki = {...state};
        delete nextByWiki[wikiId];
        return nextByWiki;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function lastPagesInvalidated(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.INVALIDATE_PAGES: {
        const {wikiId, timestamp} = action.data;

        return {
            ...state,
            [wikiId]: timestamp,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextState = {...state};
        delete nextState[wikiId];
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function lastDraftsInvalidated(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.INVALIDATE_DRAFTS: {
        const {wikiId, timestamp} = action.data;
        return {
            ...state,
            [wikiId]: timestamp,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextState = {...state};
        delete nextState[wikiId];
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function publishedDraftTimestamps(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.PUBLISH_DRAFT_SUCCESS: {
        const {pageId, publishedAt} = action.data;
        return {
            ...state,
            [pageId]: publishedAt,
        };
    }
    case WikiTypes.DELETED_DRAFT: {
        const {id, publishedAt} = action.data;
        if (!publishedAt) {
            return state;
        }
        const existingTimestamp = state[id] || 0;
        if (publishedAt <= existingTimestamp) {
            return state;
        }
        return {
            ...state,
            [id]: publishedAt,
        };
    }
    case WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS: {
        const {staleThreshold} = action.data;
        let changed = false;
        const nextState: Record<string, number> = {};
        Object.entries(state).forEach(([pageId, timestamp]) => {
            if (timestamp > staleThreshold) {
                nextState[pageId] = timestamp;
            } else {
                changed = true;
            }
        });
        return changed ? nextState : state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function deletedDraftTimestamps(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.DRAFT_DELETION_RECORDED: {
        const {draftId, deletedAt} = action.data;

        const existingTimestamp = state[draftId] || 0;
        if (deletedAt <= existingTimestamp) {
            return state;
        }

        return {
            ...state,
            [draftId]: deletedAt,
        };
    }
    case WikiTypes.DRAFT_DELETION_REVERTED: {
        // API delete failed - remove tombstone so draft can be shown again
        const {draftId} = action.data;
        if (!state[draftId]) {
            return state;
        }
        const nextState = {...state};
        delete nextState[draftId];
        return nextState;
    }
    case WikiTypes.CLEANUP_DELETED_DRAFT_TIMESTAMPS: {
        const {staleThreshold} = action.data;
        let changed = false;
        const nextState: Record<string, number> = {};

        Object.entries(state).forEach(([draftId, timestamp]) => {
            if (timestamp > staleThreshold) {
                nextState[draftId] = timestamp;
            } else {
                changed = true;
            }
        });

        return changed ? nextState : state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function commentsById(state: Record<string, Post> = {}, action: AnyAction): Record<string, Post> {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGE_COMMENTS: {
        const {comments} = action.data as {pageId: string; comments: Post[]};
        if (!comments || comments.length === 0) {
            return state;
        }
        const next = {...state};
        comments.forEach((c: Post) => {
            if (c?.id) {
                next[c.id] = c;
            }
        });
        return next;
    }
    case WikiTypes.RECEIVED_PAGE_COMMENT: {
        const {comment} = action.data as {comment: Post};
        if (!comment?.id) {
            return state;
        }
        return {...state, [comment.id]: comment};
    }
    case WikiTypes.DELETED_PAGE_COMMENT: {
        const {commentId} = action.data as {commentId: string; pageId?: string};
        if (!commentId || !state[commentId]) {
            return state;
        }
        const next = {...state};
        delete next[commentId];
        return next;
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId} = action.data;
        if (!pageId) {
            return state;
        }
        const next: Record<string, Post> = {};
        let changed = false;
        Object.values(state).forEach((c) => {
            if (c.props?.[PagePropsKeys.PAGE_ID] === pageId) {
                changed = true;
            } else {
                next[c.id] = c;
            }
        });
        return changed ? next : state;
    }
    case WikiTypes.DELETED_WIKI: {
        // We don't have a direct wiki→page mapping here; stale entries will be
        // overwritten on next fetch. Only clean up from byWiki is handled in that sub-reducer.
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function commentsByPageId(state: Record<string, string[]> = {}, action: AnyAction): Record<string, string[]> {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGE_COMMENTS: {
        const {pageId, comments} = action.data as {pageId: string; comments: Post[]};
        if (!pageId || !comments) {
            return state;
        }
        const ids = comments.map((c: Post) => c.id).filter(Boolean);

        // Preserve any IDs added via WS during fetch (not in the fetched list)
        const existing = state[pageId] || [];
        const fetched = new Set(ids);
        const addedDuringFetch = existing.filter((id) => !fetched.has(id));
        return {
            ...state,
            [pageId]: Array.from(new Set([...ids, ...addedDuringFetch])),
        };
    }
    case WikiTypes.RECEIVED_PAGE_COMMENT: {
        const {comment} = action.data as {comment: Post};
        if (!comment?.id) {
            return state;
        }
        const pageId = comment.props?.[PagePropsKeys.PAGE_ID] as string | undefined;
        if (!pageId) {
            return state;
        }
        const existing = state[pageId] || [];
        if (existing.includes(comment.id)) {
            return state;
        }
        return {...state, [pageId]: [...existing, comment.id]};
    }
    case WikiTypes.DELETED_PAGE_COMMENT: {
        const {commentId, pageId} = action.data as {commentId: string; pageId?: string};
        if (!commentId) {
            return state;
        }
        if (pageId && state[pageId]) {
            return {...state, [pageId]: state[pageId].filter((id) => id !== commentId)};
        }

        // pageId unknown: scan all
        let changed = false;
        const next: Record<string, string[]> = {};
        Object.entries(state).forEach(([pid, ids]) => {
            const filtered = ids.filter((id) => id !== commentId);
            if (filtered.length !== ids.length) {
                changed = true;
            }
            next[pid] = filtered;
        });
        return changed ? next : state;
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId} = action.data;
        if (!pageId || !state[pageId]) {
            return state;
        }
        const next = {...state};
        delete next[pageId];
        return next;
    }
    case WikiTypes.DELETED_WIKI: {
        // We don't have a direct wiki→page mapping here; stale entries will be
        // overwritten on next fetch. Only clean up the wiki's page IDs from byWiki
        // is handled in that sub-reducer.
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

const pagesReducer = combineReducers({

    // mapping of page id to Page
    byId,

    // mapping of wiki id to array of page ids
    byWiki,

    // timestamp of last pages invalidation per wiki
    lastPagesInvalidated,

    // timestamp of last drafts invalidation per wiki
    lastDraftsInvalidated,

    // timestamps of recently published drafts (for deduplication)
    publishedDraftTimestamps,

    // timestamps of recently deleted drafts (prevents stale refetch from restoring them)
    deletedDraftTimestamps,

    // flat map of comment id to Post (page_comment type)
    commentsById,

    // mapping of page id to ordered array of all comment/reply IDs for that page
    commentsByPageId,
});

export default pagesReducer;

// Derived from the actual combined reducer so the exported type reflects the real
// per-slice shapes. `ReturnType<typeof combineReducers>` alone resolves to
// Reducer<any, AnyAction>, which would make PagesState `any`.
export type PagesState = ReturnType<typeof pagesReducer>;
