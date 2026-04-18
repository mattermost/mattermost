// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

import {duration, testConfig} from '@mattermost/playwright-lib';

// NOTE: the previous `globalConfigSpecs` list + `chrome-serial` project
// was removed. Isolating config-mutating specs in a second project made
// Playwright re-run the entire dependency project on every shard (94%
// duplication), and even inside chrome-serial it only serialized w.r.t.
// the main suite — concurrent chrome-serial tests at PW_WORKERS=2 still
// raced on the shared global config.
//
// Going forward, specs that previously belonged to `chrome-serial` must
// isolate their own setup: create unique teams / channels / users per
// test, patch only the narrowest config scope they need, and clean up
// their mutations via `test.afterAll`. Tests must not assume their
// settings survive past their own `afterAll`.

const chromeUse = {
    browserName: 'chromium' as const,
    permissions: ['notifications', 'clipboard-read', 'clipboard-write'] as string[],
    viewport: {width: 1280, height: 1024},
};

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
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
            dependencies: ['setup'],
        },
        {
            // Main project — runs the entire functional suite (other than
            // @visual) under PW_WORKERS concurrency. Tests that mutate
            // global server config MUST isolate their own setup and clean
            // up any config patches in `test.afterAll`; the old
            // `chrome-serial` escape hatch was removed because it made
            // Playwright re-run the full chrome suite on every shard.
            name: 'chrome',
            use: chromeUse,
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
        ...(testConfig.isCI ? [['blob', {outputDir: './results/blob-report'}] as const] : []),
        ['html', {open: 'never', outputFolder: './results/reporter'}],
        ['json', {outputFile: './results/reporter/results.json'}],
        ['junit', {outputFile: './results/reporter/results.xml'}],
        ['list'],
    ],
});
