// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import './src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../e2e-tests/playwright/playwright.config';

import {explorerMode} from './src/modes.ts';
import {REPORTS_DIR, RESULTS_DIR, SRC_DIR, outDir} from './src/paths.ts';

const mode = explorerMode();
const chrome = baseConfig.projects?.find((p) => p.name === 'chrome');
if (!chrome) {
    throw new Error('The repo Playwright config no longer defines a "chrome" project.');
}

const testLocation = {
    replay: {testDir: outDir(), testMatch: '*.spec.ts', testIgnore: '**/runs/**'},
    explore: {testDir: SRC_DIR, testMatch: 'explore.pw.ts'},
    'guard-check': {testDir: SRC_DIR, testMatch: 'guard_check.pw.ts'},
    'guard-race': {testDir: SRC_DIR, testMatch: 'guard_race.pw.ts'},
    'probe-absence': {testDir: SRC_DIR, testMatch: 'absence_probe.pw.ts'},
}[mode];

// The repo globalSetup is skipped: it would create a default team and reset plugins on the shared
// seeded server. Testcontainers stays off (env.ts refuses PW_USE_TESTCONTAINERS).
export default defineConfig({
    ...baseConfig,
    globalSetup: undefined,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    fullyParallel: false,
    outputDir: path.join(RESULTS_DIR, mode),
    ...testLocation,
    use: {
        ...baseConfig.use,
        screenshot: 'off',
        video: 'off',
        trace: 'off',
        serviceWorkers: 'block',
    },
    projects: [{name: 'chrome', use: {...chrome.use, serviceWorkers: 'block'}}],
    reporter: [['list'], ['json', {outputFile: path.join(REPORTS_DIR, `${mode}.json`)}]],
});
