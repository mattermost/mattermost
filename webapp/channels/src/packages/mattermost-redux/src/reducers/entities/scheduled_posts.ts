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
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        const scheduledPost = action.data.scheduledPost;

        const newState = {...state};
        let modified = false;

        Object.keys(state).some((teamId: string) => {
            const index = newState[teamId].findIndex((existingScheduledPost) => existingScheduledPost.id === scheduledPost.id);

            if (index >= 0) {
                newState[teamId] = [...newState[teamId]];
                newState[teamId].splice(index, 1);
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
                const scheduledPostIDsWithError = teamScheduledPosts.
                    filter((scheduledPost) => scheduledPost.error_code).
                    map((scheduledPost) => scheduledPost.id);

                if (state[teamId] !== scheduledPostIDsWithError) {
                    changed = true;
                    newState[teamId] = scheduledPostIDsWithError;
                }
            }
        });

        return changed ? newState : state;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        let changed = false;

        const teamId = action.data.teamId || 'directChannels';
        const newState = {...state};
        if (!newState[teamId]) {
            newState[teamId] = [];
        }

        const scheduledPost = action.data.scheduledPost as ScheduledPost;
        if (scheduledPost.error_code) {
            const alreadyExists = newState[teamId].find((scheduledPostId) => scheduledPostId === scheduledPost.id);
            if (!alreadyExists) {
                newState[teamId] = [...newState[teamId], scheduledPost.id];
                changed = true;
            }
        }

        return changed ? newState : state;
    }
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        let changed = false;

        const scheduledPost = action.data.scheduledPost as ScheduledPost;
        const newState = {...state};

        Object.keys(state).some((teamId: string) => {
            const index = newState[teamId].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);

            if (index >= 0) {
                changed = true;
                newState[teamId] = [...newState[teamId]];
                newState[teamId].splice(index, 1);
                return true;
            }

            return false;
        });

        return changed ? newState : state;
    }
    case UserTypes.LOGOUT_SUCCESS: {
        return {};
    }
    default:
        return state;
    }
}

function byChannelId(state: ScheduledPostsState['byChannelId'] = {}, action: AnyAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (scheduledPostsByTeamId.hasOwnProperty(teamId)) {
                scheduledPostsByTeamId[teamId].forEach((scheduledPost: ScheduledPost) => {
                    if (newState[scheduledPost.channel_id]) {
                        newState[scheduledPost.channel_id].push(scheduledPost.id);
                    } else {
                        newState[scheduledPost.channel_id] = [scheduledPost.id];
                    }
                });
            }
        });

        return newState;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        console.log('SINGLE_SCHEDULED_POST_RECEIVED');
        const scheduledPost = action.data.scheduledPost;
        const newState = {...state};

        if (!newState[scheduledPost.channel_id]) {
            newState[scheduledPost.channel_id] = [scheduledPost.id];
            return newState;
        }

        let changed = false;
        const existingIndex = newState[scheduledPost.channel_id].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);

        if (existingIndex) {
            newState[scheduledPost.channel_id] = [...newState[scheduledPost.channel_id], scheduledPost.id];
            changed = true;
        }

        return changed ? newState : state;
    }
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        const scheduledPost = action.data.scheduledPost;
        if (!state[scheduledPost.channel_id]) {
            return state;
        }

        const newState = {...state};
        const index = newState[scheduledPost.channel_id].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);
        newState[scheduledPost.channel_id] = [...newState[scheduledPost.channel_id]];
        newState[scheduledPost.channel_id].splice(index, 1);

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
    errorsByTeamId,
    byChannelId,
});
