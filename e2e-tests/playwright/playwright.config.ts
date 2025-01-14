// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

import {duration} from '@e2e-support/util';
import testConfig from '@e2e-test.config';

export default defineConfig({
    globalSetup: require.resolve('./global_setup'),
    forbidOnly: testConfig.isCI,
    outputDir: './results/output',
    retries: testConfig.isCI ? 2 : 0,
    testDir: 'tests',
    timeout: duration.one_min,
    workers: testConfig.workers,
    expect: {
        timeout: duration.ten_sec,
        toHaveScreenshot: {
            threshold: 0.4,
            maxDiffPixelRatio: 0.0001,
            animations: 'disabled',
        },
    },
    use: {
        baseURL: testConfig.baseURL,
        ignoreHTTPSErrors: true,
        headless: testConfig.headless,
        locale: 'en-US',
        launchOptions: {
            args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
            firefoxUserPrefs: {
                'media.navigator.streams.fake': true,
                'permissions.default.microphone': 1,
                'permissions.default.camera': 1,
            },
            slowMo: testConfig.slowMo,
        },
        screenshot: 'only-on-failure',
        timezoneId: 'America/Los_Angeles',
        trace: 'off',
        video: 'retain-on-failure',
        actionTimeout: duration.half_min,
    },
    projects: [
        {
            name: 'ipad',
            use: {
                browserName: 'chromium',
                ...devices['iPad Pro 11'],
                permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
            },
        },
        {
            name: 'chrome',
            use: {
                browserName: 'chromium',
                permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
                viewport: {width: 1280, height: 1024},
            },
        },
        {
            name: 'firefox',
            use: {
                browserName: 'firefox',
                permissions: ['notifications'],
                viewport: {width: 1280, height: 1024},
            },
        },
    ],
    reporter: [
        ['html', {open: 'never', outputFolder: './results/reporter'}],
        ['json', {outputFile: './results/reporter/results.json'}],
        ['junit', {outputFile: './results/reporter/results.xml'}],
        ['list'],
    ],
});
