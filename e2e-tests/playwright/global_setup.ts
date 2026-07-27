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
        const message = error instanceof Error ? error.message : String(error);
        const hint = testConfig.useTestContainers
            ? 'Check the container named above and its logs under logs/.'
            : `Ensure the server at ${testConfig.baseURL} is running and accessible.`;
        throw new Error(`Global setup failed: ${message}\n\t${hint}`, {cause: error});
    }

    return async function () {
        await stopStack();
    };
}

export default globalSetup;
