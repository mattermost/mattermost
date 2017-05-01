// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {combineReducers} from 'redux';
import {ActionTypes, Constants} from 'utils/constants.jsx';
import {ChannelTypes} from 'mattermost-redux/action_types';

function postVisibility(state = {}, action) {
    switch (action.type) {
    case ChannelTypes.SELECT_CHANNEL: {
        const nextState = {...state};
        nextState[action.data] = Constants.POST_CHUNK_SIZE / 2;
        return nextState;
    }
    case ActionTypes.INCREASE_POST_VISIBILITY: {
        const nextState = {...state};
        nextState[action.data] += Constants.POST_CHUNK_SIZE / 2;
        return nextState;
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

export default combineReducers({
    postVisibility,
    lastChannelViewTime
});
