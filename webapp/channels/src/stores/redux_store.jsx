// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This is a temporary store while we are transitioning from Flux to Redux. This file exports
// the configured Redux store for use by actions and selectors.

import configureStore from 'store';

const store = configureStore();

// eslint-disable-next-line no-process-env
if (process.env.NODE_ENV !== 'production' || window.location.origin === 'https://community.mattermost.com') {
    window.store = store;
}

export default store;
