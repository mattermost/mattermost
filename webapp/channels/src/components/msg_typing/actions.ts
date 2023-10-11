// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getMissingProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';
import {General, Preferences, WebsocketEvents} from 'mattermost-redux/constants';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

function getTimeBetweenTypingEvents(state: GlobalState) {
    const config = getConfig(state);

    return config.TimeBetweenUserTypingUpdatesMilliseconds === undefined ? 0 : parseInt(config.TimeBetweenUserTypingUpdatesMilliseconds, 10);
}

export function userStartedTyping(userId: string, channelId: string, rootId: string, now: number) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();

        if (
            isPerformanceDebuggingEnabled(state) &&
            getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_TYPING_MESSAGES)
        ) {
            return;
        }

        dispatch({
            type: WebsocketEvents.TYPING,
            data: {
                id: channelId + rootId,
                userId,
                now,
            },
        });

        // Ideally this followup loading would be done by someone else
        dispatch(fillInMissingInfo(userId));

        setTimeout(() => {
            dispatch(userStoppedTyping(userId, channelId, rootId, now));
        }, getTimeBetweenTypingEvents(state));
    };
}

function fillInMissingInfo(userId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        if (userId !== currentUserId) {
            const result = await dispatch(getMissingProfilesByIds([userId]));
            if (result.data && result.data.length > 0) {
                // Already loaded the user status
                return {data: false};
            }
        }

        const status = getStatusForUserId(state, userId);
        if (status !== General.ONLINE) {
            dispatch(getStatusesByIds([userId]));
        }

        return {data: true};
    };
}

export function userStoppedTyping(userId: string, channelId: string, rootId: string, now: number) {
    return {
        type: WebsocketEvents.STOP_TYPING,
        data: {
            id: channelId + rootId,
            userId,
            now,
        },
    };
}
