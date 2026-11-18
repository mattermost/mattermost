// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

/**
 * The lib's own tests (`npm test` in lib): the runtime (drivers, settle, matchers, lists) against pages a local HTTP
 * server serves, with no Mattermost server.
 */
export default defineConfig({
    testDir: './test',
    timeout: 30_000,
    expect: {timeout: 2_000},
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    reporter: [['list']],
    outputDir: './test-results',
    use: {
        browserName: 'chromium',
        headless: true,
        actionTimeout: 2_000,
    },
});
