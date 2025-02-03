// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ChannelTypes, PostTypes, UserTypes, GeneralTypes} from 'mattermost-redux/action_types';

import {ActionTypes, Constants} from 'utils/constants';

import type {MMAction} from 'types/store';

function postVisibility(state: {[channelId: string]: number} = {}, action: MMAction) {
    switch (action.type) {
    case ChannelTypes.SELECT_CHANNEL: {
        const nextState = {...state};
        nextState[action.data] = Constants.POST_CHUNK_SIZE / 2;
        return nextState;
    }
    case ActionTypes.INCREASE_POST_VISIBILITY: {
        const nextState = {...state};
        nextState[action.data] += action.amount;
        return nextState;
    }
    case ActionTypes.RECEIVED_FOCUSED_POST: {
        const nextState = {...state};
        nextState[action.channelId] = Constants.POST_CHUNK_SIZE / 2;
        return nextState;
    }
    case PostTypes.RECEIVED_NEW_POST: {
        if (action.data && state[action.data.channel_id]) {
            const nextState = {...state};
            nextState[action.data.channel_id] += 1;
            return nextState;
        }
        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function lastChannelViewTime(state: {[channelId: string]: number} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SELECT_CHANNEL_WITH_MEMBER: {
        if (action.member) {
            const nextState = {...state};
            nextState[action.data] = action.member.last_viewed_at;
            return nextState;
        }
        return state;
    }
    case ActionTypes.UPDATE_CHANNEL_LAST_VIEWED_AT: {
        const nextState = {...state};
        nextState[action.channel_id] = action.last_viewed_at;
        return nextState;
    }

    case ActionTypes.POST_UNREAD_SUCCESS: {
        const data = action.data;
        return {...state, [data.channelId]: data.lastViewedAt};
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function loadingPosts(state: {[channelId: string]: boolean} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.LOADING_POSTS: {
        const nextState = {...state};
        nextState[action.channelId] = action.data;
        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function focusedPostId(state = '', action: MMAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_FOCUSED_POST:
        return action.data;
    case ChannelTypes.SELECT_CHANNEL:
        return '';

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function mobileView(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.UPDATE_MOBILE_VIEW:
        return action.data;

    default:
        return state;
    }
}

// lastUnreadChannel tracks if the current channel was unread and if it had mentions when the user switched to it.
function lastUnreadChannel(state: ({channelId: string; hadMentions: boolean}) | null = null, action: MMAction) {
    switch (action.type) {
    case ChannelTypes.LEAVE_CHANNEL:
        if (action.data.id === state?.channelId) {
            return null;
        }
        return state;
    case ActionTypes.SET_LAST_UNREAD_CHANNEL: {
        const {
            channelId,
            hadMentions,
            hadUnreads,
        } = action;

        if (hadMentions || hadUnreads) {
            return {
                id: channelId,
                hadMentions,
            };
        }

        return null;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

function lastGetPosts(state: {[channelId: string]: number} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_POSTS_FOR_CHANNEL_AT_TIME:
        return {
            ...state,
            [action.channelId]: action.time,
        };
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function toastStatus(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SELECT_CHANNEL_WITH_MEMBER:
        return false;
    case ActionTypes.UPDATE_TOAST_STATUS:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function channelPrefetchStatus(state: {[channelId: string]: string} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.PREFETCH_POSTS_FOR_CHANNEL:
        return {
            ...state,
            [action.channelId]: action.status,
        };
    case GeneralTypes.WEBSOCKET_FAILURE:
    case GeneralTypes.WEBSOCKET_CLOSED:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    postVisibility,
    lastChannelViewTime,
    loadingPosts,
    focusedPostId,
    mobileView,
    lastUnreadChannel,
    lastGetPosts,
    toastStatus,
    channelPrefetchStatus,
});
