// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TopReaction, TimeFrame} from '@mattermost/types/insights';
import {combineReducers} from 'redux';

import {InsightTypes} from 'mattermost-redux/action_types';
import {GenericAction} from 'mattermost-redux/types/actions';

const sortReactionsIntoState = (data: TopReaction[]) => {
    const newItems: Record<string, TopReaction> = {};

    for (let i = 0; i < data.length; i++) {
        const emojiObj = data[i];
        newItems[emojiObj.emoji_name] = emojiObj;
    }

    return newItems;
};

function topReactions(state: Record<string, Record<TimeFrame, Record<string, TopReaction>>> = {}, action: GenericAction) {
    switch (action.type) {
    case InsightTypes.RECEIVED_TOP_REACTIONS: {
        const results = action.data.data.items || [];
        const timeFrame = action.data.timeFrame as TimeFrame;

        const newItems = sortReactionsIntoState(results);

        return {
            ...state,
            [action.id]: {
                ...(state[action.id] || {}),
                [timeFrame]: newItems,
            },
        };
    }
    default:
        return state;
    }
}

function myTopReactions(state: Record<string, Record<TimeFrame, Record<string, TopReaction>>> = {}, action: GenericAction) {
    switch (action.type) {
    case InsightTypes.RECEIVED_MY_TOP_REACTIONS: {
        const results = action.data.data.items || [];
        const timeFrame = action.data.timeFrame as TimeFrame;

        const newItems = sortReactionsIntoState(results);

        return {
            ...state,
            [action.id]: {
                ...(state[action.id] || {}),
                [timeFrame]: newItems,
            },
        };
    }
    default:
        return state;
    }
}

export default combineReducers({

    // Object where every key is the team id, another nested object where the key is TimeFrame and that TimeFrame key has an object of reactions where the key is the emoji_name
    topReactions,

    myTopReactions,
});
