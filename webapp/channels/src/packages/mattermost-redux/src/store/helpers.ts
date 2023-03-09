// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction, combineReducers, Reducer} from 'redux';
import {enableBatching} from 'redux-batched-actions';

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

export function createReducer(...reducerSets: Array<Record<string, Reducer>>) {
    // Merge each dictionary of reducers into a single combined reducer
    let reducer: Reducer = combineReducers(reducerSets.reduce((fullSet, reducerSet) => {
        return {...fullSet, ...reducerSet};
    }, {}));

    reducer = enableBatching(reducer);
    reducer = enableFreezing(reducer);

    return reducer;
}

function enableFreezing<S, A extends AnyAction>(reducer: Reducer<S, A>) {
    // Skip the overhead of freezing in production.
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV === 'production') {
        return reducer;
    }

    const frozenReducer = (state: S | undefined, action: A): S => {
        const nextState = reducer(state, action);

        if (nextState !== state) {
            deepFreezeAndThrowOnMutation(nextState);
        }

        return nextState;
    };

    return frozenReducer;
}
