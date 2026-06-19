// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {Page} from '@mattermost/types/wikis';

import {PagePropsKeys} from 'mattermost-redux/constants/pages';
import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {fetchPage} from 'actions/pages';

import {getPageIdFromComment} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

// In-flight fetch dedup: multiple mounted comment previews referencing the same
// page all see `!page` simultaneously on first render. Without this, each one
// would dispatch its own getPage before the first response populates the store.
const pendingPageFetches = new Set<string>();

// Test-only: Jest retains this module across `it` blocks in the same worker.
// A test that mocks fetchPage to reject synchronously or never resolve leaves
// its pageId in the Set, which silently suppresses fetches in later tests.
export function clearPendingPageFetchesForTests(): void {
    pendingPageFetches.clear();
}

export type PageForCommentStatus = 'loading' | 'loaded' | 'missing';

export type PageForCommentResult = {
    page: Page | null;
    status: PageForCommentStatus;
};

// Returns the page referenced by a page-comment post along with a fetch
// status that distinguishes "still loading" from "confirmed missing/deleted".
// Pages live in entities.pages.byId, which is only populated when a user opens
// a wiki or editor; a channel member viewing a comment on a wiki they have
// never opened would otherwise see null here.
export function usePageForComment(comment: Post | null | undefined): PageForCommentResult {
    const dispatch = useDispatch();
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const pageId = getPageIdFromComment(comment) ?? '';
    const wikiId = comment?.props?.[PagePropsKeys.WIKI_ID] as string | undefined;

    const page = useSelector((state: GlobalState) => (pageId ? getPageById(state, pageId) : undefined));

    useEffect(() => {
        if (!pageId || !wikiId) {
            return;
        }
        if (page) {
            setHasAttemptedFetch(true);
            return;
        }

        // Keyed by pageId:wikiId so a cross-wiki move of the same pageId
        // doesn't get blocked by a stale in-flight fetch for the old wikiId.
        const dedupKey = `${pageId}:${wikiId}`;
        if (pendingPageFetches.has(dedupKey)) {
            return;
        }
        pendingPageFetches.add(dedupKey);
        Promise.resolve(dispatch(fetchPage(pageId, wikiId))).finally(() => {
            pendingPageFetches.delete(dedupKey);
            if (mountedRef.current) {
                setHasAttemptedFetch(true);
            }
        });

    // page is intentionally omitted: when it transitions undefined → Post we don't
    // want to re-run only to early-exit. pageId/wikiId changes already re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, pageId, wikiId]);

    if (page) {
        return {page, status: 'loaded'};
    }
    if (!pageId || !wikiId || !hasAttemptedFetch) {
        return {page: null, status: 'loading'};
    }
    return {page: null, status: 'missing'};
}
