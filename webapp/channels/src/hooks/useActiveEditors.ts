// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getActiveEditorsWithProfiles} from 'mattermost-redux/selectors/entities/active_editors';

import type {GlobalState} from 'types/store';

import {
    fetchActiveEditors,
    handleDraftCreated,
    handleDraftUpdated,
    handleDraftDeleted,
    removeStaleEditors,
} from 'actions/active_editors';

export type ActiveEditorWithUser = {
    userId: string;
    lastActivity: number;
    user: UserProfile;
};

/**
 * Hook to get active editors for a page.
 * Fetches initial state and subscribes to WebSocket events via cleanup.
 *
 * @param wikiId - The wiki ID containing the page
 * @param pageId - The page ID to track editors for
 * @returns Array of active editors with user profiles
 */
export function useActiveEditors(wikiId: string, pageId: string): ActiveEditorWithUser[] {
    const dispatch = useDispatch();
    const editors = useSelector((state: GlobalState) => getActiveEditorsWithProfiles(state, pageId));
    const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    console.log('[useActiveEditors] Hook called with:', {wikiId, pageId, editorsCount: editors.length});

    useEffect(() => {
        if (!pageId || !wikiId) {
            console.log('[useActiveEditors] Missing pageId or wikiId, skipping fetch');
            return;
        }

        console.log('[useActiveEditors] Setting up for:', {wikiId, pageId});
        console.log('[useActiveEditors] Fetching initial active editors');
        dispatch(fetchActiveEditors(wikiId, pageId));

        console.log('[useActiveEditors] Setting up cleanup interval (60s) for pageId:', pageId);
        cleanupIntervalRef.current = setInterval(() => {
            console.log('[useActiveEditors] Cleanup interval fired for pageId:', pageId);
            dispatch(removeStaleEditors(pageId));
        }, 60000);

        return () => {
            console.log('[useActiveEditors] Cleanup: clearing interval for pageId:', pageId);
            if (cleanupIntervalRef.current) {
                clearInterval(cleanupIntervalRef.current);
                cleanupIntervalRef.current = null;
            }
        };
    }, [pageId, wikiId, dispatch]);

    return editors;
}

/**
 * WebSocket event handlers (called from global WebSocket handler)
 */
export function handleActiveEditorDraftCreated(pageId: string, userId: string, timestamp: number) {
    return (dispatch: any) => {
        dispatch(handleDraftCreated(pageId, userId, timestamp));
    };
}

export function handleActiveEditorDraftUpdated(pageId: string, userId: string, timestamp: number) {
    return (dispatch: any) => {
        dispatch(handleDraftUpdated(pageId, userId, timestamp));
    };
}

export function handleActiveEditorDraftDeleted(pageId: string, userId: string) {
    return (dispatch: any) => {
        dispatch(handleDraftDeleted(pageId, userId));
    };
}

export function handleActiveEditorStopped(pageId: string, userId: string) {
    return (dispatch: any) => {
        // Same behavior as draft deleted - remove user from active editors
        dispatch(handleDraftDeleted(pageId, userId));
    };
}
