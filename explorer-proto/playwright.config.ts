// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import './src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../e2e-tests/playwright/playwright.config';

import {explorerMode} from './src/modes.ts';
import {SRC_DIR, outDir, reportsDir, resultsDir, sessionName, journeyName} from './src/paths.ts';
import {journeySpecLocation} from './src/journey_spec_path.ts';
import {CONTAINMENT_LAUNCH_ARGS} from './src/journey_containment.ts';

const mode = explorerMode();
// PILOT_SESSION=<name> (set by `cli.ts --session=<name>`) selects the charter session explorer and its
// generated dir; without it every mode behaves exactly as before.
const session = sessionName();
const journey = journeyName();
const chrome = baseConfig.projects?.find((p) => p.name === 'chrome');
if (!chrome) {
    throw new Error('The repo Playwright config no longer defines a "chrome" project.');
}

const journeyReplay = journey ? journeySpecLocation(journey) : null;

const testLocation = {
    replay: {
        testDir: outDir(),
        testMatch: '*.spec.ts',
        testIgnore: '**/runs/**',
    },
    explore: {
        testDir: SRC_DIR,
        testMatch: session ? 'explore_session.pw.ts' : 'explore.pw.ts',
    },
    'guard-check': {testDir: SRC_DIR, testMatch: 'guard_check.pw.ts'},
    'guard-race': {testDir: SRC_DIR, testMatch: 'guard_race.pw.ts'},
    'probe-absence': {testDir: SRC_DIR, testMatch: 'absence_probe.pw.ts'},
    'guard-journey': {testDir: SRC_DIR, testMatch: 'guard_journey.pw.ts'},
    'explore-journey': {testDir: SRC_DIR, testMatch: 'explore_journey.pw.ts'},
    // The emitted repo-native spec runs from the repo specs tree (it never imports explorer-proto).
    'replay-journey': {
        testDir: journeyReplay?.dir ?? SRC_DIR,
        testMatch: journeyReplay?.file ?? 'replay_journey_requires_journey',
    },
}[mode];

// Containment for the unmodified repo-native spec: host-resolver rules applied at browser launch.
const journeyLaunchArgs = mode === 'replay-journey' ? CONTAINMENT_LAUNCH_ARGS : [];

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
        launchOptions: {
            ...(baseConfig.use?.launchOptions ?? {}),
            args: [...((baseConfig.use?.launchOptions as {args?: string[]})?.args ?? []), ...journeyLaunchArgs],
        },
    },
    projects: [
        {
            name: 'chrome',
            use: {
                ...chrome.use,
                serviceWorkers: 'block',
                launchOptions: {
                    ...((chrome.use as {launchOptions?: object})?.launchOptions ?? {}),
                    args: [
                        ...((
                            chrome.use as {
                                launchOptions?: {args?: string[]};
                            }
                        )?.launchOptions?.args ?? []),
                        ...journeyLaunchArgs,
                    ],
                },
            },
        },
    ],
    reporter: [['list'], ['json', {outputFile: path.join(reportsDir(), `${mode}.json`)}]],
});
