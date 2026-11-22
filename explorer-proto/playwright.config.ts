// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Side-effect import first: sets PW_BASE_URL before the repo config loads testConfig.
import './src/env.ts';

import {defineConfig} from '@playwright/test';

import baseConfig from '../e2e-tests/playwright/playwright.config';

import {WS_LNA_LAUNCH_ARG} from './src/guard.ts';
import {explorerMode} from './src/modes.ts';
import {SCRATCH_DIR, SRC_DIR, outDir, reportsDir, resultsDir, sessionName, journeyName} from './src/paths.ts';
import {journeySpecLocation} from './src/journey_spec_path.ts';
import {thinContainmentLaunchArgs} from './src/journey_containment.ts';
import {SCRATCH_SPEC_NAME} from './src/containment_scratch.ts';

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
    'guard-journey-spec': {testDir: SCRATCH_DIR, testMatch: SCRATCH_SPEC_NAME},
    'explore-journey': {testDir: SRC_DIR, testMatch: 'explore_journey.pw.ts'},
    'journey-selftest': {testDir: SRC_DIR, testMatch: 'journey_selftest.pw.ts'},
    // The emitted repo-native spec runs from the repo specs tree (it never imports explorer-proto).
    'replay-journey': {
        testDir: journeyReplay?.dir ?? SRC_DIR,
        testMatch: journeyReplay?.file ?? 'replay_journey_requires_journey',
    },
}[mode];

// Plain repo-native specs (and the guard-journey scratch spec) get exact-origin containment through the
// browser launch args; modes that run the application-level guard get the WebSocket LNA workaround.
const THIN_MODES = ['replay-journey', 'guard-journey-spec'];
const GUARDED_MODES = [
    'replay',
    'explore',
    'explore-journey',
    'guard-check',
    'guard-race',
    'probe-absence',
    'journey-selftest',
];

function modeLaunchArgs(): string[] {
    if (THIN_MODES.includes(mode)) {
        return thinContainmentLaunchArgs(mode);
    }
    return GUARDED_MODES.includes(mode) && process.env.EXPLORER_WS_LNA_WORKAROUND !== '0' ? [WS_LNA_LAUNCH_ARG] : [];
}

const extraLaunchArgs = modeLaunchArgs();

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
            args: [...((baseConfig.use?.launchOptions as {args?: string[]})?.args ?? []), ...extraLaunchArgs],
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
                        ...extraLaunchArgs,
                    ],
                },
            },
        },
    ],
    reporter: [['list'], ['json', {outputFile: path.join(reportsDir(), `${mode}.json`)}]],
});
