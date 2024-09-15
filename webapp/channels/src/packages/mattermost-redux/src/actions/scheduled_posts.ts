// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {ScheduledPostTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

export function createSchedulePost(schedulePost: ScheduledPost, connectionId: string) {
    return async () => {
        try {
            const createdPost = await Client4.createScheduledPost(schedulePost, connectionId);
            return {data: createdPost};

            // TODO: dispatch action to store created schedule
            // post in store to display it.
        } catch (error) {
            return {
                error,
            };
        }
    };
}

export default function fetchTeamScheduledPosts(teamId: string, includeDirectChannels: boolean) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let scheduledPosts;

        try {
            scheduledPosts = await Client4.getScheduledPosts(teamId, includeDirectChannels);
            dispatch({
                type: ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED,
                data: {
                    scheduledPostsByTeamId: scheduledPosts.data,
                },
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: scheduledPosts};
    };
}
