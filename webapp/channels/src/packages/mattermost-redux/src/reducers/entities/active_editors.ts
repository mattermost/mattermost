// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import ActiveEditorsTypes from 'mattermost-redux/action_types/active_editors';
import {UserTypes} from 'mattermost-redux/action_types';

export type ActiveEditorInfo = {
    userId: string;
    lastActivity: number;
};

export type ActiveEditorsState = {
    byPageId: Record<string, Record<string, ActiveEditorInfo>>;
};

function byPageId(
    state: ActiveEditorsState['byPageId'] = {},
    action: MMReduxAction,
): ActiveEditorsState['byPageId'] {
    switch (action.type) {
    case ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS: {
        const {pageId, editors} = action.data;
        const editorsMap: Record<string, ActiveEditorInfo> = {};

        editors.forEach((editor: ActiveEditorInfo) => {
            editorsMap[editor.userId] = editor;
        });

        return {
            ...state,
            [pageId]: editorsMap,
        };
    }

    case ActiveEditorsTypes.ACTIVE_EDITOR_ADDED:
    case ActiveEditorsTypes.ACTIVE_EDITOR_UPDATED: {
        const {pageId, userId, lastActivity} = action.data;

        return {
            ...state,
            [pageId]: {
                ...(state[pageId] || {}),
                [userId]: {userId, lastActivity},
            },
        };
    }

    case ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED: {
        const {pageId, userId} = action.data;

        if (!state[pageId]) {
            return state;
        }

        const nextPageState = {...state[pageId]};
        Reflect.deleteProperty(nextPageState, userId);

        if (Object.keys(nextPageState).length === 0) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, pageId);
            return nextState;
        }

        return {
            ...state,
            [pageId]: nextPageState,
        };
    }

    case ActiveEditorsTypes.STALE_EDITORS_REMOVED: {
        const {pageId, staleThreshold} = action.data;

        console.log('[STALE_CLEANUP_REDUCER] Processing STALE_EDITORS_REMOVED:', {
            pageId,
            staleThreshold,
            hasPageState: !!state[pageId],
            allPageIds: Object.keys(state),
        });

        if (!state[pageId]) {
            console.log('[STALE_CLEANUP_REDUCER] No state for pageId, returning unchanged');
            return state;
        }

        const nextPageState: Record<string, ActiveEditorInfo> = {};
        let hasChanges = false;
        const removedEditors: string[] = [];
        const keptEditors: string[] = [];

        Object.values(state[pageId]).forEach((editor) => {
            if (editor.lastActivity >= staleThreshold) {
                nextPageState[editor.userId] = editor;
                keptEditors.push(editor.userId);
            } else {
                hasChanges = true;
                removedEditors.push(editor.userId);
            }
        });

        console.log('[STALE_CLEANUP_REDUCER] Cleanup results:', {
            pageId,
            hasChanges,
            removedEditors,
            keptEditors,
            nextStateSize: Object.keys(nextPageState).length,
        });

        if (!hasChanges) {
            console.log('[STALE_CLEANUP_REDUCER] No changes, returning same state');
            return state;
        }

        if (Object.keys(nextPageState).length === 0) {
            console.log('[STALE_CLEANUP_REDUCER] All editors removed, deleting page entry');
            const nextState = {...state};
            Reflect.deleteProperty(nextState, pageId);
            return nextState;
        }

        console.log('[STALE_CLEANUP_REDUCER] Returning updated state with remaining editors');
        return {
            ...state,
            [pageId]: nextPageState,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

export default combineReducers({
    byPageId,
});
