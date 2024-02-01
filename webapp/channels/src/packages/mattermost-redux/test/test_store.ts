// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import configureStore from 'mattermost-redux/store';

export default function testConfigureStore<State extends GlobalState = GlobalState>(preloadedState?: any) {
    const store = configureStore<State>({preloadedState, appReducers: {}, getAppReducers: () => ({})});

    return store;
}

// This should probably be replaced by redux-mock-store like the web app
export function mockDispatch(dispatch: Dispatch) {
    const mocked: Dispatch & {actions: AnyAction[]} = (action: any) => {
        dispatch(action);

        mocked.actions.push(action);
    };

    mocked.actions = [];

    return mocked;
}
