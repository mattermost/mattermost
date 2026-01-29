// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {UserTypes} from 'mattermost-redux/action_types';
import ActiveEditorsTypes from 'mattermost-redux/action_types/active_editors';

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
        delete nextPageState[userId];

        if (Object.keys(nextPageState).length === 0) {
            const nextState = {...state};
            delete nextState[pageId];
            return nextState;
        }

        return {
            ...state,
            [pageId]: nextPageState,
        };
    }

    case ActiveEditorsTypes.STALE_EDITORS_REMOVED: {
        const {pageId, staleThreshold} = action.data;

        if (!state[pageId]) {
            return state;
        }

        const nextPageState: Record<string, ActiveEditorInfo> = {};
        let hasChanges = false;

        Object.values(state[pageId]).forEach((editor) => {
            if (editor.lastActivity >= staleThreshold) {
                nextPageState[editor.userId] = editor;
            } else {
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            return state;
        }

        if (Object.keys(nextPageState).length === 0) {
            const nextState = {...state};
            delete nextState[pageId];
            return nextState;
        }

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
