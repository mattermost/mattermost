// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {updateThreadRead} from 'mattermost-redux/actions/threads';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {isThreadManuallyUnread, isThreadOpen} from 'selectors/views/threads';

import {ActionTypes, Threads} from 'utils/constants';

import type {ThunkActionFunc} from 'types/store';

export function updateThreadLastOpened(threadId: string, lastViewedAt: number) {
    return {
        type: Threads.CHANGED_LAST_VIEWED_AT,
        data: {
            threadId,
            lastViewedAt,
        },
    };
}

export function updateThreadLastUpdateAt(threadId: string, lastUpdateAt: number) {
    return {
        type: Threads.CHANGED_LAST_UPDATE_AT,
        data: {
            threadId,
            lastUpdateAt,
        },
    };
}

export function setSelectedThreadId(teamId: string, threadId: string | undefined) {
    return {
        type: Threads.CHANGED_SELECTED_THREAD,
        data: {
            thread_id: threadId,
            team_id: teamId,
        },
    };
}

export function manuallyMarkThreadAsUnread(threadId: string, lastViewedAt: number) {
    return batchActions([
        updateThreadLastOpened(threadId, lastViewedAt),
        {
            type: Threads.MANUALLY_UNREAD_THREAD,
            data: {threadId},
        },
    ]);
}

export function updateThreadToastStatus(status: boolean) {
    return {
        type: ActionTypes.UPDATE_THREAD_TOAST_STATUS,
        data: status,
    };
}

export function markThreadAsRead(threadId: string): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);
        const thread = getThread(state, threadId);

        if (thread && isThreadOpen(state, threadId) && window.isActive && !isThreadManuallyUnread(state, threadId)) {
            // mark thread as read on the server
            dispatch(updateThreadRead(currentUserId, currentTeamId, threadId, Date.now()));
        }
    };
}
