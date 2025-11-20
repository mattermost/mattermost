// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ActiveEditorsTypes from 'mattermost-redux/action_types/active_editors';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, DispatchFunc} from 'mattermost-redux/types/actions';

import {logError} from './errors';

const STALE_EDITOR_THRESHOLD = 5 * 60 * 1000;

export type ActiveEditorInfo = {
    userId: string;
    lastActivity: number;
};

export type PageActiveEditorsResponse = {
    user_ids: string[];
    last_activities: Record<string, number>;
};

export function fetchActiveEditors(wikiId: string, pageId: string): ActionFuncAsync<ActiveEditorInfo[]> {
    return async (dispatch: DispatchFunc, getState) => {
        const currentUserId = getCurrentUserId(getState());

        try {
            const response = await Client4.getPageActiveEditors(wikiId, pageId);

            const editors = response.user_ids
                .filter((userId: string) => userId !== currentUserId)
                .map((userId: string) => ({
                    userId,
                    lastActivity: response.last_activities[userId],
                }));

            dispatch({
                type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                data: {pageId, editors},
            });

            return {data: editors};
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }
    };
}

export function handleDraftCreated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState) => {
        const currentUserId = getCurrentUserId(getState());

        if (userId === currentUserId) {
            return {data: true};
        }

        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
            data: {pageId, userId, lastActivity: timestamp},
        });

        return {data: true};
    };
}

export function handleDraftUpdated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState) => {
        const currentUserId = getCurrentUserId(getState());

        console.log('[ACTIVE_EDITORS] handleDraftUpdated called:', {
            pageId,
            userId,
            timestamp,
            currentUserId,
            isCurrentUser: userId === currentUserId,
        });

        if (userId === currentUserId) {
            console.log('[ACTIVE_EDITORS] Skipping - is current user');
            return {data: true};
        }

        console.log('[ACTIVE_EDITORS] Dispatching ACTIVE_EDITOR_UPDATED for pageId:', pageId);
        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_UPDATED,
            data: {pageId, userId, lastActivity: timestamp},
        });

        return {data: true};
    };
}

export function handleDraftDeleted(pageId: string, userId: string): ActionFuncAsync {
    return async (dispatch: DispatchFunc) => {
        console.log('[ACTIVE_EDITORS] handleDraftDeleted called:', {pageId, userId});
        dispatch({
            type: ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED,
            data: {pageId, userId},
        });

        return {data: true};
    };
}

export function removeStaleEditors(pageId: string): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState) => {
        const now = Date.now();
        const staleThreshold = now - STALE_EDITOR_THRESHOLD;

        console.log('[STALE_CLEANUP] removeStaleEditors called:', {
            pageId,
            now,
            staleThreshold,
            thresholdAge: STALE_EDITOR_THRESHOLD,
        });

        // Log current editors before cleanup
        const state = getState();
        const currentEditors = state.entities.activeEditors?.byPageId?.[pageId] || {};
        console.log('[STALE_CLEANUP] Current editors before cleanup:', {
            pageId,
            editorsCount: Object.keys(currentEditors).length,
            editors: Object.values(currentEditors).map((e: any) => ({
                userId: e.userId,
                lastActivity: e.lastActivity,
                age: now - e.lastActivity,
                isStale: e.lastActivity < staleThreshold,
            })),
        });

        dispatch({
            type: ActiveEditorsTypes.STALE_EDITORS_REMOVED,
            data: {pageId, staleThreshold},
        });

        return {data: true};
    };
}
