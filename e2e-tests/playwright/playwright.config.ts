// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

import {duration, testConfig} from '@mattermost/playwright-lib';

const chromeUse = {
    browserName: 'chromium' as const,
    permissions: ['notifications', 'clipboard-read', 'clipboard-write'] as string[],
    viewport: {width: 1280, height: 1024},
};

export default defineConfig({
    globalSetup: './global_setup.ts',
    forbidOnly: testConfig.isCI,
    outputDir: './results/output',
    retries: testConfig.isCI ? 1 : 0,
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
        toMatchAriaSnapshot: {
            pathTemplate: '{testDir}/{testFilePath}-snapshots-a11y/{arg}{ext}',
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
        timezoneId: new Intl.DateTimeFormat().resolvedOptions().timeZone,
        trace: 'retain-on-failure',
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
            testIgnore: /specs[\\/]+components[\\/]+/,
            dependencies: ['setup'],
        },
        {
            name: 'chrome',
            use: chromeUse,
            testIgnore: /specs[\\/]+components[\\/]+/,
            dependencies: ['setup'],
        },
        {
            name: 'firefox',
            use: {
                browserName: 'firefox',
                permissions: ['notifications'],
                viewport: {width: 1280, height: 1024},
            },
            testIgnore: /specs[\\/]+components[\\/]+/,
            dependencies: ['setup'],
        },
        {
            name: 'components',
            testDir: 'specs/components',
            dependencies: ['setup'],
        },
    ],
    reporter: [
        ...(testConfig.isCI ? [['blob', {outputDir: './results/blob-report'}] as const] : []),
        ['html', {open: 'never', outputFolder: './results/reporter'}],
        ['json', {outputFile: './results/reporter/results.json'}],
        ['junit', {outputFile: './results/reporter/results.xml'}],
        ['list'],
    ],
});
