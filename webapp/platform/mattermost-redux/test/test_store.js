// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import configureStore from 'mattermost-redux/store';

export default function testConfigureStore(preloadedState) {
    const store = configureStore({preloadedState, appReducers: {}, getAppReducers: () => {}});

    return store;
}

export function mockStore(initialState) {
    return configureMockStore([thunk])(initialState);
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
