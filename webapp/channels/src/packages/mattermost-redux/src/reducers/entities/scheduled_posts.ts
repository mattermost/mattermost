// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {ScheduledPostsState} from '@mattermost/types/schedule_post';

import {ScheduledPostTypes, UserTypes} from 'mattermost-redux/action_types';

function byTeamId(state: ScheduledPostsState['byTeamId'] = {}, action: AnyAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (scheduledPostsByTeamId.hasOwnProperty(teamId)) {
                newState[teamId] = scheduledPostsByTeamId[teamId];
            }
        });

        return newState;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        const scheduledPost = action.data.scheduledPost;
        const teamId = action.data.teamId || 'directChannels';

        const newState = {...state};

        if (newState[teamId]) {
            newState[teamId] = [...newState[teamId], scheduledPost];
        } else {
            newState[teamId] = [scheduledPost];
        }

        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    byTeamId,
});
