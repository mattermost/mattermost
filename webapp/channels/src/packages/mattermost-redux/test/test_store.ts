// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import configureStore from 'mattermost-redux/store';

export function makeInitialState<S extends GlobalState = GlobalState>(preloadedState?: DeepPartial<S>) {
    return testConfigureStore(preloadedState).getState();
}

export default function testConfigureStore<S extends GlobalState = GlobalState>(preloadedState?: DeepPartial<S>) {
    const store = configureStore<S>({preloadedState, appReducers: {}});

    return store;
}

type MockedDispatch = {
    (action: AnyAction): void;
    actions: AnyAction[];
};

// This should probably be replaced by redux-mock-store like the web app
export function mockDispatch(dispatch: Dispatch): MockedDispatch {
    const mocked = ((action: AnyAction) => {
        dispatch(action);

        mocked.actions.push(action);
    }) as MockedDispatch;

    mocked.actions = [];

    return mocked;
}
