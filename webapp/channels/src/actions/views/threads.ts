// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {updateThreadRead} from 'mattermost-redux/actions/threads';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {isThreadManuallyUnread} from 'reducers/views/threads';
import {isThreadOpen} from 'selectors/views/threads';

import type {ThunkActionFunc} from 'types/store';

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
