// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';
import {ActionTypes} from 'utils/constants';

import type {ScheduledPostsState} from '@mattermost/types/schedule_post';

function byTeamId(state: ScheduledPostsState['byTeamId'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPosts, teamId} = action.data;
        return {
            ...state,
            [teamId]: scheduledPosts,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    byTeamId,
});
