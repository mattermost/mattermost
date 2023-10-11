// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reducer} from 'redux';

// Based on http://nicolasgallagher.com/redux-modules-and-code-splitting/
export class ReducerRegistry {
    emitChange?: (reducers: Record<string, Reducer>) => void;
    reducers: Record<string, Reducer> = {};

    setReducers = (reducers: Record<string, Reducer>): void => {
        this.reducers = reducers;
    };

    getReducers = (): Record<string, Reducer> => {
        return {...this.reducers};
    };

    register = (name: string, reducer: Reducer): void => {
        this.reducers = {...this.reducers, [name]: reducer};
        if (this.emitChange) {
            this.emitChange(this.getReducers());
        }
    };

    setChangeListener = (listener: (reducers: Record<string, Reducer>) => void): void => {
        this.emitChange = listener;
    };
}

const reducerRegistry = new ReducerRegistry();
export default reducerRegistry;
