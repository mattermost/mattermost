// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {ActionTypes, Threads} from 'utils/constants';

export function updateThreadLastOpened(threadId: string, lastViewedAt: number) {
    return {
        type: Threads.CHANGED_LAST_VIEWED_AT,
        data: {
            threadId,
            lastViewedAt,
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
