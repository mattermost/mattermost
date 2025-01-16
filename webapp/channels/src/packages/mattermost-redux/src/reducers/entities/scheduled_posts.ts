// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ScheduledPost, ScheduledPostsState} from '@mattermost/types/schedule_post';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ScheduledPostTypes, UserTypes} from 'mattermost-redux/action_types';

function byId(state: ScheduledPostsState['byId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (Object.hasOwn(scheduledPostsByTeamId, teamId)) {
                scheduledPostsByTeamId[teamId].forEach((scheduledPost: ScheduledPost) => {
                    newState[scheduledPost.id] = scheduledPost;
                });
            }
        });

        return newState;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        const scheduledPost = action.data.scheduledPost;
        return {
            ...state,
            [scheduledPost.id]: scheduledPost,
        };
    }
    case ScheduledPostTypes.SCHEDULED_POST_UPDATED: {
        const scheduledPost = action.data.scheduledPost;
        return {
            ...state,
            [scheduledPost.id]: scheduledPost,
        };
    }
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        const scheduledPost = action.data.scheduledPost;
        const newState = {...state};
        delete newState[scheduledPost.id];
        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function byTeamId(state: ScheduledPostsState['byTeamId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (Object.hasOwn(scheduledPostsByTeamId, teamId)) {
                newState[teamId] = scheduledPostsByTeamId[teamId].map((scheduledPost: ScheduledPost) => scheduledPost.id);
            }
        });

        return newState;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        const scheduledPost = action.data.scheduledPost as ScheduledPost;
        const teamId = action.data.teamId || 'directChannels';

        const newState = {...state};

        const existingIndex = newState[teamId].findIndex((existingScheduledPostId) => existingScheduledPostId === scheduledPost.id);
        if (existingIndex >= 0) {
            newState[teamId].splice(existingIndex, 1);
        }

        if (newState[teamId]) {
            newState[teamId] = [...newState[teamId], scheduledPost.id];
        } else {
            newState[teamId] = [scheduledPost.id];
        }

        return newState;
    }
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        const scheduledPost = action.data.scheduledPost as ScheduledPost;

        const newState = {...state};
        let modified = false;

        for (const teamId of Object.keys(state)) {
            const index = newState[teamId].findIndex((existingScheduledPostId) => existingScheduledPostId === scheduledPost.id);

            if (index >= 0) {
                newState[teamId] = [...newState[teamId]];
                newState[teamId].splice(index, 1);
                modified = true;

                break;
            }
        }

        return modified ? newState : state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function errorsByTeamId(state: ScheduledPostsState['errorsByTeamId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId} = action.data;
        const newState = {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (Object.hasOwn(scheduledPostsByTeamId, teamId)) {
                const teamScheduledPosts = scheduledPostsByTeamId[teamId] as ScheduledPost[];
                newState[teamId] = teamScheduledPosts.filter((scheduledPost) => scheduledPost.error_code).map((scheduledPost) => scheduledPost.id);
            }
        });

        return newState;
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

        for (const teamId of Object.keys(state)) {
            const index = newState[teamId].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);

            if (index >= 0) {
                changed = true;
                newState[teamId] = [...newState[teamId]];
                newState[teamId].splice(index, 1);
                break;
            }
        }
        return changed ? newState : state;
    }
    case UserTypes.LOGOUT_SUCCESS: {
        return {};
    }
    default:
        return state;
    }
}

function byChannelOrThreadId(state: ScheduledPostsState['byChannelOrThreadId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ScheduledPostTypes.SCHEDULED_POSTS_RECEIVED: {
        const {scheduledPostsByTeamId, prune} = action.data;
        const newState = prune ? {} : {...state};

        Object.keys(scheduledPostsByTeamId).forEach((teamId: string) => {
            if (Object.hasOwn(scheduledPostsByTeamId, teamId)) {
                scheduledPostsByTeamId[teamId].forEach((scheduledPost: ScheduledPost) => {
                    const id = scheduledPost.root_id || scheduledPost.channel_id;

                    // Check if the entry for that channel/thread ID exists
                    if (newState[id]) {
                        // Only add if its not already there
                        if (!newState[id].includes(scheduledPost.id)) {
                            newState[id] = [...newState[id], scheduledPost.id];
                        }
                    } else {
                        // If the entry does not exist at this moment, create it
                        newState[id] = [scheduledPost.id];
                    }
                });
            }
        });

        return newState;
    }
    case ScheduledPostTypes.SINGLE_SCHEDULED_POST_RECEIVED: {
        const scheduledPost = action.data.scheduledPost;
        const newState = {...state};
        const id = scheduledPost.root_id || scheduledPost.channel_id;

        if (!newState[id]) {
            newState[id] = [scheduledPost.id];
            return newState;
        }

        let changed = false;
        const existingIndex = newState[id].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);

        if (existingIndex) {
            newState[id] = [...newState[id], scheduledPost.id];
            changed = true;
        }

        return changed ? newState : state;
    }
    case ScheduledPostTypes.SCHEDULED_POST_DELETED: {
        const scheduledPost = action.data.scheduledPost;
        const id = scheduledPost.root_id || scheduledPost.channel_id;

        if (!state[id]) {
            return state;
        }

        const newState = {...state};
        const index = newState[id].findIndex((scheduledPostId) => scheduledPostId === scheduledPost.id);
        newState[id] = [...newState[id]];
        newState[id].splice(index, 1);

        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    byId,
    byTeamId,
    byChannelOrThreadId,
    errorsByTeamId,
});
