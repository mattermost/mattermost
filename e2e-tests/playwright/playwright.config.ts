// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig, devices} from '@playwright/test';

import {duration, testConfig} from '@mattermost/playwright-lib';

/**
 * Spec files that mutate global server config and must NOT run in parallel
 * with the main test suite. These are placed in the "chrome-serial" project
 * which depends on "chrome", so Playwright runs them only after all parallel
 * tests on the shard have completed.
 *
 * Each entry here is a regex that matches the file path relative to testDir.
 * When adding a new spec that calls updateConfig() / patchConfig() on
 * server-wide settings (ABAC, notifications, privacy, shared channels, etc.),
 * add it here to avoid flaky failures under PW_WORKERS >= 2.
 */
const globalConfigSpecs: RegExp[] = [
    // AccessControlSettings (ABAC enable/disable)
    /team_settings\/team_settings_membership_policies.*\.spec\.ts$/,
    /team_settings\/team_settings_policy_editor.*\.spec\.ts$/,

    // ContentFlaggingSettings
    /content_flagging\/flagging\/flag-messages.*\.spec\.ts$/,
    /content_flagging\/notifications\/author-notification.*\.spec\.ts$/,

    // ConnectedWorkspacesSettings (shared channels)
    /shared_channel_configuration.*\.spec\.ts$/,

    // PrivacySettings (anonymous URLs, email/name visibility)
    /anonymous_urls.*\.spec\.ts$/,
    /account_settings\/profile\/popover_fields.*\.spec\.ts$/,

    // TeamSettings (managed categories)
    /managed_categories.*\.spec\.ts$/,

    // EmailSettings / SupportSettings (notification config)
    /notifications\/system_console.*\.spec\.ts$/,

    // AutoTranslationSettings
    /autotranslation\/autotranslation_permissions.*\.spec\.ts$/,

    // ServiceSettings (collapsed threads, burn-on-read, email invitations)
    /message_scroll\/thread_appears_and_scrollable_in_the_rhs.*\.spec\.ts$/,
    /burn_on_read\/.*\.spec\.ts$/,
    /team_settings\/invite_user_to_closed_team.*\.spec\.ts$/,

    // GuestAccountsSettings
    /single_channel_guests.*\.spec\.ts$/,

    // Office365/SAML settings
    /mobile_security.*\.spec\.ts$/,

    // PluginSettings / FileSettings
    /plugins\/demo_plugin\/.*\.spec\.ts$/,

    // ServiceSettings (desktop app, self-deleting messages)
    /desktop_app_update_required.*\.spec\.ts$/,
    /self_deleting_messages.*\.spec\.ts$/,
];

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
            // Main parallel project — runs the bulk of the suite with PW_WORKERS
            // concurrency. Specs that mutate global server config are excluded
            // here and run in "chrome-serial" after this project completes.
            name: 'chrome',
            use: chromeUse,
            testIgnore: globalConfigSpecs,
            dependencies: ['setup'],
        },
        {
            // Serialized project for specs that mutate global server config.
            //
            // IMPORTANT: do NOT set `dependencies: ['chrome']` here. Playwright
            // does not shard tests in a dependency project — every shard would
            // run the full "chrome" suite as setup, producing ~94% duplication
            // across shards (see PR #36054 investigation). Instead, this project
            // is invoked as a SECOND sharded pass by `server.run_playwright.sh`,
            // after the "chrome" pass finishes on the same runner. That keeps
            // the "no concurrent global-config mutation with chrome tests"
            // invariant while letting both projects shard properly.
            //
            // Tests in this project come from different config domains
            // (ABAC, notifications, privacy, etc.) so they rarely conflict
            // with each other when 2 run in parallel.
            name: 'chrome-serial',
            use: chromeUse,
            testMatch: globalConfigSpecs,
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
