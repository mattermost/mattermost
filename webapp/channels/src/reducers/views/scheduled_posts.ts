// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';
import {ActionTypes} from 'utils/constants';

import type {ScheduledPostsState} from '@mattermost/types/schedule_post';
import {groupBy} from "utils/utils";

function byTeamId(state: ScheduledPostsState['byTeamId'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.SCHEDULED_POSTS_RECEIVED: {
        const scheduledPosts = action.data;

        const scheduledPostsByTeamId = groupBy(scheduledPosts, 'teamId');

    }
    default:
        return state;
    }
}

export default combineReducers({
    byTeamId,
});
