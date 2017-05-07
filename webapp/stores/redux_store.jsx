// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// This is a temporary store while we are transitioning from Flux to Redux. This file exports
// the configured Redux store for use by actions and selectors.

import configureStore from 'store';
const store = configureStore();

export function bindActionToRedux(action, ...args) {
    return async () => {
        await action(...args)(store.dispatch, store.getState);
    };
}

window.store = store;

export default store;

