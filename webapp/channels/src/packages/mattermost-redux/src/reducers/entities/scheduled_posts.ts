// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {ScheduledPost, ScheduledPostsState} from '@mattermost/types/schedule_post';

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

        const existingIndex = newState[teamId].findIndex((existingScheduledPost) => existingScheduledPost.id === scheduledPost.id);
        if (existingIndex >= 0) {
            newState[teamId].splice(existingIndex, 1);
        }

        if (newState[teamId]) {
            newState[teamId] = [...newState[teamId], scheduledPost];
        } else {
            newState[teamId] = [scheduledPost];
        }

        return newState;
    }
    case ScheduledPostTypes.SCHEDULED_POST_UPDATED: {
        const scheduledPost = action.data.scheduledPost;

        const newState = {...state};
        let modified = false;

        Object.keys(state).some((teamId: string) => {
            const index = newState[teamId].findIndex((existingScheduledPost) => existingScheduledPost.id === scheduledPost.id);

            if (index >= 0) {
                newState[teamId] = [...newState[teamId]];
                newState[teamId][index] = scheduledPost;
                modified = true;

                // return true makes some() not loop through remaining array
                return true;
            }

            // returning false makes some() continue looping through the array
            return false;
        });

        return modified ? newState : state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function errorsByTeamId(state: ScheduledPostsState['errorsByTeamId'] = {}, action: AnyAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};
        let changed = false;

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (scheduledPostsByTeamId.hasOwnProperty(teamId)) {
                const teamScheduledPosts = scheduledPostsByTeamId[teamId] as ScheduledPost[];
                const updatedHasError = teamScheduledPosts.some((scheduledPost) => scheduledPost.error_code);

                if (state[teamId] !== updatedHasError) {
                    changed = true;
                    newState[teamId] = updatedHasError;
                }
            }
        });

        return changed ? newState : state;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        const teamId = action.data.teamId || 'directChannels';

        // if team already has an error state, then irrespective of what's the error
        // on new scheduled post, the team would still have an error.
        // So nothing changes so we return the original state as-in.
        if (state[teamId]) {
            return state;
        }

        const scheduledPost = action.data.scheduledPost as ScheduledPost;

        // if team doesn't have any error and neither does the new scheduled post,
        // then nothing changes so we return the original state as-in.
        if (!scheduledPost.error_code || state[teamId]) {
            return state;
        }

        return {
            ...state,
            [teamId]: true,
        };
    }
    case UserTypes.LOGOUT_SUCCESS: {
        return {};
    }
    default:
        return state;
    }
}

export default combineReducers({
    byTeamId,
    errorsByTeamId,
});
