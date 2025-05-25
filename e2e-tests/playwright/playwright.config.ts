// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

import {duration, testConfig} from '@mattermost/playwright-lib';

export default defineConfig({
    globalSetup: './global_setup.ts',
    forbidOnly: testConfig.isCI,
    outputDir: './results/output',
    retries: testConfig.isCI ? 2 : 0,
    testDir: 'specs',
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
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
        trace: 'off',
        video: 'retain-on-failure',
        actionTimeout: duration.half_min,
    },
    projects: [
        {name: 'setup', testMatch: /test_setup\.ts/},
        {
            name: 'ipad',
            use: {
                browserName: 'chromium',
                ...devices['iPad Pro 11'],
                permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
            },
            dependencies: ['setup'],
        },
        {
            name: 'chrome',
            use: {
                browserName: 'chromium',
                permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
                viewport: {width: 1280, height: 1024},
            },
            dependencies: ['setup'],
        },
        {
            name: 'firefox',
            use: {
                browserName: 'firefox',
                permissions: ['notifications'],
                viewport: {width: 1280, height: 1024},
            },
            dependencies: ['setup'],
        },
    ],
    reporter: [
        ['html', {open: 'never', outputFolder: './results/reporter'}],
        ['json', {outputFile: './results/reporter/results.json'}],
        ['junit', {outputFile: './results/reporter/results.xml'}],
        ['list'],
    ],
});
