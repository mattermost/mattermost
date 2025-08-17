// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {ScheduledPostTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

export function createSchedulePost(schedulePost: ScheduledPost, teamId: string, connectionId: string) {
    return async (dispatch: DispatchFunc) => {
        try {
            const createdPost = await Client4.createScheduledPost(schedulePost, connectionId);

            dispatch({
                type: ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED,
                data: {
                    scheduledPost: createdPost.data,
                    teamId,
                },
            });

            return {data: createdPost};
        } catch (error) {
            return {
                error,
            };
        }
    };
}

export function fetchTeamScheduledPosts(teamId: string, includeDirectChannels: boolean, prune?: false) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let scheduledPosts;

        try {
            scheduledPosts = await Client4.getScheduledPosts(teamId, includeDirectChannels);
            dispatch({
                type: ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED,
                data: {
                    scheduledPostsByTeamId: scheduledPosts.data,
                    prune,
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

export function updateScheduledPost(scheduledPost: ScheduledPost, connectionId: string) {
    return async (dispatch: DispatchFunc) => {
        try {
            const updatedScheduledPost = await Client4.updateScheduledPost(scheduledPost, connectionId);

            dispatch({
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {
                    scheduledPost: updatedScheduledPost.data,
                },
            });

            return {data: updatedScheduledPost};
        } catch (error) {
            return {
                error,
            };
        }
    };
}

export function deleteScheduledPost(userId: string, scheduledPostId: string, connectionId: string) {
    return async (dispatch: DispatchFunc) => {
        try {
            const deletedScheduledPost = await Client4.deleteScheduledPost(userId, scheduledPostId, connectionId);

            dispatch({
                type: ScheduledPostTypes.SCHEDULED_POST_DELETED,
                data: {
                    scheduledPost: deletedScheduledPost.data,
                },
            });

            return {data: deletedScheduledPost};
        } catch (error) {
            return {
                error,
            };
        }
    };
}
