// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import '../../src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../../../e2e-tests/playwright/playwright.config';

const runDir = path.resolve(process.env.ORACLE_RUN_DIR || path.join(__dirname, '.run'));
const chrome = baseConfig.projects?.find((p) => p.name === 'chrome');
if (!chrome) {
    throw new Error('The repo Playwright config no longer defines a "chrome" project.');
}

// Chromium's Local Network Access check blocks the app's loopback WebSocket when the document was fulfilled by
// the guard's route.fulfill. Default ON for the oracle suite; ORACLE_LNA_WORKAROUND=0 reproduces the guard's behaviour.
const extraBrowserArgs =
    process.env.ORACLE_LNA_WORKAROUND === '0' ? [] : ['--disable-features=LocalNetworkAccessChecks'];

export default defineConfig({
    ...baseConfig,
    globalSetup: undefined,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    fullyParallel: false,
    testDir: __dirname,
    testMatch: process.env.ORACLE_SPEC || 'measure.pw.ts',
    outputDir: path.join(runDir, 'test-results'),
    use: {
        ...baseConfig.use,
        launchOptions: {
            ...baseConfig.use?.launchOptions,
            args: [...(baseConfig.use?.launchOptions?.args ?? []), ...extraBrowserArgs],
        },
        screenshot: 'off',
        video: 'off',
        trace: 'off',
        serviceWorkers: 'block',
    },
    projects: [{name: 'chrome', use: {...chrome.use, serviceWorkers: 'block'}}],
    reporter: [['list'], ['json', {outputFile: path.join(runDir, 'playwright-report.json')}]],
});
