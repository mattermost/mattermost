// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import chalk from 'chalk';

import {startStack, stopStack} from '@mattermost/playwright-lib';

// Deliberately skips baseGlobalSetup() (admin user bootstrap, sysadmin setup, plugin config):
// `npm run testcontainers:up` is for bringing up a fresh, untouched server for poking around or
// for a later `npm run test` to reuse — not for preparing it as if a real suite were about to run.
async function globalSetup() {
    try {
        await startStack();
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(chalk.cyan('[testcontainers]'), error);
        await stopStack();
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(chalk.red(`[testcontainers] stack failed to start: ${message}`));
    }

    return async function () {
        await stopStack();
    };
}

export default globalSetup;
