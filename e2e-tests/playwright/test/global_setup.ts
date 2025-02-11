// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {baseGlobalSetup} from '@mattermost/playwright-lib';

async function globalSetup() {
    await baseGlobalSetup();

    return function () {
        // placeholder for teardown setup
    };
}

export default globalSetup;
