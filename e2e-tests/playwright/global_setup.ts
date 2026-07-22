// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {baseGlobalSetup, startStack, stopStack, testConfig} from '@mattermost/playwright-lib';

async function globalSetup() {
    try {
        // With PW_USE_TESTCONTAINERS=true, bring up the server + dependencies via Testcontainers
        // before pinging it. No-op otherwise, when a server is expected to already be running.
        await startStack();
        await baseGlobalSetup();
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(error);
        throw new Error(
            `Global setup failed.\n\tEnsure the server at ${testConfig.baseURL} is running and accessible.\n\tPlease check the logs for more details.`,
        );
    }

    return async function () {
        await stopStack();
    };
}

export default globalSetup;
