// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import './src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../e2e-tests/playwright/playwright.config';

import {explorerMode} from './src/modes.ts';
import {SRC_DIR, outDir, reportsDir, resultsDir, sessionName} from './src/paths.ts';

const mode = explorerMode();
// PILOT_SESSION=<name> (set by `cli.ts --session=<name>`) selects the charter session explorer and its
// generated dir; without it every mode behaves exactly as before.
const session = sessionName();
const chrome = baseConfig.projects?.find((p) => p.name === 'chrome');
if (!chrome) {
    throw new Error('The repo Playwright config no longer defines a "chrome" project.');
}

const testLocation = {
    replay: {testDir: outDir(), testMatch: '*.spec.ts', testIgnore: '**/runs/**'},
    explore: {testDir: SRC_DIR, testMatch: session ? 'explore_session.pw.ts' : 'explore.pw.ts'},
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
    outputDir: path.join(resultsDir(), mode),
    ...testLocation,
    use: {
        ...baseConfig.use,
        screenshot: 'off',
        video: 'off',
        trace: 'off',
        serviceWorkers: 'block',
    },
    projects: [{name: 'chrome', use: {...chrome.use, serviceWorkers: 'block'}}],
    reporter: [['list'], ['json', {outputFile: path.join(reportsDir(), `${mode}.json`)}]],
});
