// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureStore from 'mattermost-redux/store';

export function makeInitialState(preloadedState) {
    return testConfigureStore(preloadedState).getState();
}

export default function testConfigureStore(preloadedState) {
    const store = configureStore({preloadedState, appReducers: {}, getAppReducers: () => {}});

    return store;
}

// This should probably be replaced by redux-mock-store like the web app
export function mockDispatch(dispatch) {
    const mocked = (action) => {
        dispatch(action);

        mocked.actions.push(action);
    };

    mocked.actions = [];

    return mocked;
}
