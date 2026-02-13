// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ActiveEditorsTypes from 'mattermost-redux/action_types/active_editors';
import {Client4} from 'mattermost-redux/client';
import type {ActiveEditorInfo} from 'mattermost-redux/reducers/entities/active_editors';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {getMissingProfilesByIds} from './users';

const STALE_EDITOR_THRESHOLD = 5 * 60 * 1000;

export type PageActiveEditorsResponse = {
    user_ids: string[];
    last_activities: Record<string, number>;
};

export function fetchActiveEditors(wikiId: string, pageId: string): ActionFuncAsync<ActiveEditorInfo[]> {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentUserId = getCurrentUserId(getState());

        try {
            const response = await Client4.getPageActiveEditors(wikiId, pageId);

            const editorUserIds = response.user_ids.filter((userId: string) => userId !== currentUserId);
            const editors = editorUserIds.map((userId: string) => ({
                userId,
                lastActivity: response.last_activities[userId],
            }));

            dispatch({
                type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                data: {pageId, editors},
            });

            if (editorUserIds.length > 0) {
                dispatch(getMissingProfilesByIds(editorUserIds));
            }

            return {data: editors};
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }
    };
}

export function handleDraftCreated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentUserId = getCurrentUserId(getState());

        if (userId === currentUserId) {
            return {data: true};
        }

        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
            data: {pageId, userId, lastActivity: timestamp},
        });

        dispatch(getMissingProfilesByIds([userId]));

        return {data: true};
    };
}

export function handleDraftUpdated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentUserId = getCurrentUserId(getState());

        if (userId === currentUserId) {
            return {data: true};
        }

        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_UPDATED,
            data: {pageId, userId, lastActivity: timestamp},
        });

        dispatch(getMissingProfilesByIds([userId]));

        return {data: true};
    };
}

export function handleDraftDeleted(pageId: string, userId: string): ActionFuncAsync {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED,
            data: {pageId, userId},
        });

        return {data: true};
    };
}

export function removeStaleEditors(pageId: string): ActionFuncAsync {
    return async (dispatch: DispatchFunc) => {
        const now = Date.now();
        const staleThreshold = now - STALE_EDITOR_THRESHOLD;

        dispatch({
            type: ActiveEditorsTypes.STALE_EDITORS_REMOVED,
            data: {pageId, staleThreshold},
        });

        return {data: true};
    };
}
