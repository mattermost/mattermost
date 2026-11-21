// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import '../../src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../../../e2e-tests/playwright/playwright.config';

const runDir = path.resolve(__dirname, '..', '.run', 'survey');
const chrome = baseConfig.projects?.find((p) => p.name === 'chrome');
if (!chrome) {
    throw new Error('The repo Playwright config no longer defines a "chrome" project.');
}

// Read-only measurement: the repo globalSetup would create a default team on the seeded server.
export default defineConfig({
    ...baseConfig,
    globalSetup: undefined,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    fullyParallel: false,
    testDir: __dirname,
    testMatch: 'survey_names.pw.ts',
    outputDir: path.join(runDir, 'test-results'),
    use: {
        ...baseConfig.use,
        screenshot: 'off',
        video: 'off',
        trace: 'off',
        serviceWorkers: 'block',
    },
    projects: [{name: 'chrome', use: {...chrome.use, serviceWorkers: 'block'}}],
    reporter: [['line']],
});
