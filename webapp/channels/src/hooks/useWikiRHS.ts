// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    setWikiRhsMode,
    setWikiRhsWikiId,
    setWikiRhsActiveTab,
    setFocusedInlineCommentId,
} from 'actions/views/wiki_rhs';
import {
    getWikiRhsWikiId,
    getWikiRhsMode,
    getSelectedPageId,
    getFocusedInlineCommentId,
    getWikiRhsActiveTab,
} from 'selectors/wiki_rhs';

/**
 * Hook to manage Wiki RHS state and operations.
 * Provides mode, active tab, wiki ID, and focused comment state with operations.
 *
 * @returns RHS state and operations
 */
export function useWikiRHS() {
    const dispatch = useDispatch();

    const wikiId = useSelector(getWikiRhsWikiId);
    const mode = useSelector(getWikiRhsMode);
    const selectedPageId = useSelector(getSelectedPageId);
    const focusedInlineCommentId = useSelector(getFocusedInlineCommentId);
    const activeTab = useSelector(getWikiRhsActiveTab);

    const setMode = useCallback((newMode: 'outline' | 'comments') => {
        dispatch(setWikiRhsMode(newMode));
    }, [dispatch]);

    const setWikiId = useCallback((newWikiId: string | null) => {
        dispatch(setWikiRhsWikiId(newWikiId));
    }, [dispatch]);

    const setActiveTab = useCallback((tab: 'page_comments' | 'all_threads') => {
        dispatch(setWikiRhsActiveTab(tab));
    }, [dispatch]);

    const setFocusedComment = useCallback((commentId: string | null) => {
        dispatch(setFocusedInlineCommentId(commentId));
    }, [dispatch]);

    return {
        wikiId,
        mode,
        selectedPageId,
        focusedInlineCommentId,
        activeTab,
        setMode,
        setWikiId,
        setActiveTab,
        setFocusedComment,
    };
}
