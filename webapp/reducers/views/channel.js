// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {combineReducers} from 'redux';
import {ActionTypes, Constants} from 'utils/constants.jsx';
import {ChannelTypes, PostTypes} from 'mattermost-redux/action_types';

function postVisibility(state = {}, action) {
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
    case PostTypes.RECEIVED_POST: {
        if (action.data && state[action.data.channel_id]) {
            const nextState = {...state};
            nextState[action.data.channel_id] += 1;
            return nextState;
        }
        return state;
    }
    default:
        return state;
    }
}

function lastChannelViewTime(state = {}, action) {
    switch (action.type) {
    case ChannelTypes.SELECT_CHANNEL: {
        if (action.member) {
            const nextState = {...state};
            nextState[action.data] = action.member.last_viewed_at;
            return nextState;
        }
        return state;
    }
    default:
        return state;
    }
}

function loadingPosts(state = {}, action) {
    switch (action.type) {
    case ActionTypes.LOADING_POSTS: {
        const nextState = {...state};
        nextState[action.channelId] = action.data;
        return nextState;
    }
    default:
        return state;
    }
}

function focusedPostId(state = '', action) {
    switch (action.type) {
    case ActionTypes.RECEIVED_FOCUSED_POST:
        return action.data;
    case ChannelTypes.SELECT_CHANNEL:
        return '';
    default:
        return state;
    }
}

export default combineReducers({
    postVisibility,
    lastChannelViewTime,
    loadingPosts,
    focusedPostId
});
