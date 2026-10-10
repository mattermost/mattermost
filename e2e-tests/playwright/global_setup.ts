// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import chalk from 'chalk';

import {
    baseGlobalSetup,
    clearGlobalSetupFailure,
    recordGlobalSetupFailure,
    startStack,
    stopStack,
    testConfig,
} from '@mattermost/playwright-lib';

async function globalSetup() {
    // Clear any marker a previous invocation on this worker left behind, so a stale failure
    // can't bleed into this run if it never reaches the point below where setup actually fails.
    clearGlobalSetupFailure();

    try {
        // With PW_USE_TESTCONTAINERS=true, bring up the server + dependencies via Testcontainers
        // before pinging it. No-op otherwise, when a server is expected to already be running.
        await startStack();
        await baseGlobalSetup();
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(chalk.cyan('[testcontainers]'), error);
        const message = error instanceof Error ? error.message : String(error);
        const hint = testConfig.useTestContainers
            ? 'Check the container named above and its logs under logs/.'
            : `Ensure the server at ${testConfig.baseURL} is running and accessible.`;

        // Record the failure instead of throwing, so Playwright still attempts the spec file's
        // tests (and still calls the teardown below to stop whatever startStack() brought up):
        // the resetConfigAndRoles fixture fails them loudly with this message. Throwing here
        // would abort before any test ran, leaving a report with zero test cases for the file --
        // which CI dispatch can't distinguish from a legitimately-filtered-out spec and silently
        // counts as "skipped" instead of "failed".
        recordGlobalSetupFailure(`Global setup failed: ${message}\n${hint}`);
    }

    return async function () {
        await stopStack();
    };
}

export default globalSetup;
