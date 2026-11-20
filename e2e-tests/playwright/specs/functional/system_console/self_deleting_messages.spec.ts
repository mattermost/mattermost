// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {
    openSystemConsoleSection,
    systemConsolePath,
    Api,
    duration,
    expect,
    openChannel,
    settle,
    test,
} from '@mattermost/playwright-lib';

import {concealedPost, reveal, sendBorMessage, timeRemaining} from '../channels/burn_on_read/support';

/**
 * Patch the Posts page required fields to known valid values so tests that
 * load the page always start with a saveable form state, regardless of what
 * other parallel tests may have left in the server config.
 */
async function resetPostsConfig(adminClient: {patchConfig: (config: Partial<AdminConfig>) => Promise<unknown>}) {
    await adminClient.patchConfig({
        ServiceSettings: {
            PersistentNotificationIntervalMinutes: 5,
            PersistentNotificationMaxRecipients: 5,
            PersistentNotificationMaxCount: 6,
        },
    } as Partial<AdminConfig>);
}

test.describe('System Console > Self-Deleting Messages', () => {
    test('admin can enable and disable self-deleting messages', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Reset Posts section required fields so Save button is always enabled
        await resetPostsConfig(adminClient);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // * Verify Posts section is visible
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // Get BoR setting elements
        const enableToggleTrue = app.admin.setting('ServiceSettings.EnableBurnOnRead').trueRadio;
        const enableToggleFalse = app.admin.setting('ServiceSettings.EnableBurnOnRead').falseRadio;
        const durationDropdown = app.admin.setting('ServiceSettings.BurnOnReadDurationSeconds').choiceCombobox;
        const maxTTLDropdown = app.admin.setting('ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds').choiceCombobox;

        // # If feature is enabled, disable it first
        if (await enableToggleTrue.isChecked()) {
            await enableToggleFalse.check();
            await expect(enableToggleFalse).toBeChecked();
            await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
            await expect(app.admin.saveButton).toBeSaved();
        }

        // * Verify dropdowns are disabled when feature is off
        await expect(durationDropdown).toBeDisabled();
        await expect(maxTTLDropdown).toBeDisabled();

        // # Enable the feature
        await enableToggleTrue.check();
        await expect(enableToggleTrue).toBeChecked();

        // * Verify feature is enabled
        await expect(enableToggleTrue).toBeChecked();

        // * Verify dropdowns are now enabled
        await expect(durationDropdown).toBeEnabled();
        await expect(maxTTLDropdown).toBeEnabled();

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Navigate away and back to verify persistence
        await app.admin.sidebar.category('user_management').section('system_users').titleLink.click();
        await expect(page).toHaveURL(/\/user_management\/users/);
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // * Verify feature is still enabled
        await expect(enableToggleTrue).toBeChecked();
    });

    test('admin can configure message duration', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Reset Posts section required fields so Save button is always enabled
        await resetPostsConfig(adminClient);

        // # Ensure BoR is enabled via API
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const durationDropdown = app.admin.setting('ServiceSettings.BurnOnReadDurationSeconds').choiceCombobox;

        // # Select 60 seconds duration
        await durationDropdown.choose('1 minute');
        // Native select labels are not separate generated parts.
        await expect(durationDropdown.locator.locator('option:checked')).toHaveText('1 minute');

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Navigate away and back
        await app.admin.sidebar.category('user_management').section('system_users').titleLink.click();
        await expect(page).toHaveURL(/\/user_management\/users/);
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // * Verify duration is still 60 seconds
        await expect(durationDropdown).toHaveValue('60');
    });

    test('admin can configure maximum time to live', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Reset Posts section required fields so Save button is always enabled
        await resetPostsConfig(adminClient);

        // # Ensure BoR is enabled via API
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const maxTTLDropdown = app.admin.setting('ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds').choiceCombobox;

        // # Select 1 day (86400 seconds) max TTL
        await maxTTLDropdown.choose('1 day');
        // Native select labels are not separate generated parts.
        await expect(maxTTLDropdown.locator.locator('option:checked')).toHaveText('1 day');

        // # Save settings
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // # Navigate away and back
        await app.admin.sidebar.category('user_management').section('system_users').titleLink.click();
        await expect(page).toHaveURL(/\/user_management\/users/);
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // * Verify max TTL is still 1 day
        await expect(maxTTLDropdown).toHaveValue('86400');
    });

    test('dropdowns are disabled when feature is disabled', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Disable BoR via API to start with a known state
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = false;
        await adminClient.patchConfig(config);
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings?.EnableBurnOnRead === false;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Log in as admin
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const enableToggleTrue = app.admin.setting('ServiceSettings.EnableBurnOnRead').trueRadio;
        const enableToggleFalse = app.admin.setting('ServiceSettings.EnableBurnOnRead').falseRadio;
        const durationDropdown = app.admin.setting('ServiceSettings.BurnOnReadDurationSeconds').choiceCombobox;
        const maxTTLDropdown = app.admin.setting('ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds').choiceCombobox;

        // * Verify feature is disabled (from API config) — use built-in retry to tolerate render lag
        await expect(enableToggleFalse).toBeChecked();

        // * Verify dropdowns are disabled when feature is off
        await expect(durationDropdown).toBeDisabled({timeout: duration.half_min});
        await expect(maxTTLDropdown).toBeDisabled({timeout: duration.half_min});

        // # Enable the feature (just toggle, don't save)
        await enableToggleTrue.check();
        await expect(enableToggleTrue).toBeChecked();

        // * Verify dropdowns are now enabled
        await expect(durationDropdown).not.toBeDisabled({timeout: duration.half_min});
        await expect(maxTTLDropdown).not.toBeDisabled({timeout: duration.half_min});

        // # Toggle back to disabled
        await enableToggleFalse.check();
        await expect(enableToggleFalse).toBeChecked();

        // * Verify dropdowns are disabled again
        await expect(durationDropdown).toBeDisabled({timeout: duration.half_min});
        await expect(maxTTLDropdown).toBeDisabled({timeout: duration.half_min});
    });

    test('settings persist after page reload', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Configure BoR via API with specific values (using valid dropdown options)
        // Duration: 300 (5 minutes), Max TTL: 259200 (3 days)
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 259200,
            },
        });
        // Wait until the server confirms the patch before logging in, so the browser
        // reads the correct value when it loads the Posts section. A concurrent
        // initSetup() reset may otherwise overwrite BurnOnReadDurationSeconds.
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const enableToggleTrue = app.admin.setting('ServiceSettings.EnableBurnOnRead').trueRadio;
        const durationDropdown = app.admin.setting('ServiceSettings.BurnOnReadDurationSeconds').choiceCombobox;
        const maxTTLDropdown = app.admin.setting('ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds').choiceCombobox;

        // * Verify configured values are displayed
        await expect(enableToggleTrue).toBeChecked();
        await expect(durationDropdown).toHaveValue('300');
        await expect(maxTTLDropdown).toHaveValue('259200');

        // Re-apply guard: a concurrent initSetup() may reset BoR config between
        // the initial page load and this reload.
        await adminClient.patchConfig({
            ServiceSettings: {
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 259200,
            },
        });
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Reload directly to Posts section
        await page.goto(systemConsolePath('site_config/posts'));
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        // * Verify values persist after reload — toHaveValue has built-in retry
        await expect(enableToggleTrue).toBeChecked();
        await expect(durationDropdown).toHaveValue('300');
        await expect(maxTTLDropdown).toHaveValue('259200');
    });

    test('BoR toggle appears in channels when feature is enabled in System Console', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Reset Posts section required fields so Save button is always enabled
        await resetPostsConfig(adminClient);

        // # First, disable BoR via API to start clean
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = false;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const enableToggleTrue = app.admin.setting('ServiceSettings.EnableBurnOnRead').trueRadio;

        // # Enable BoR feature
        await enableToggleTrue.check();
        await expect(enableToggleTrue).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // Re-apply guard: concurrent initSetup() may reset EnableBurnOnRead between UI save and navigation
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: true}});
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings.EnableBurnOnRead === true;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await expect(app.center.composer).toBeVisible();

        // * Verify BoR toggle is visible in post create area
        const borButton = app.center.postCreate.burnOnReadButton;
        await expect(borButton).toBeVisible();
    });

    test('BoR toggle is hidden when feature is disabled in System Console', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Reset Posts section required fields so Save button is always enabled
        await resetPostsConfig(adminClient);

        // # First, enable BoR via API
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        await adminClient.patchConfig(config);

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await openSystemConsoleSection(app);

        // # Navigate to Posts section
        await app.admin.sidebar.category('site').section('posts').titleLink.click();
        await expect(app.admin.screen('PostSettings')).toBeVisible();

        await expect(app.admin.screen('PostSettings')).toBeVisible();
        const enableToggleFalse = app.admin.setting('ServiceSettings.EnableBurnOnRead').falseRadio;

        // # Disable BoR feature
        await enableToggleFalse.check();
        await expect(enableToggleFalse).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // Re-apply guard: concurrent initSetup() may re-enable BoR between UI save and navigation
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: false}});
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings.EnableBurnOnRead === false;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await expect(app.center.composer).toBeVisible();

        // * Verify BoR toggle is NOT visible in post create area
        const borButton = app.center.postCreate.burnOnReadButton;
        await expect(borButton).not.toBeVisible();
    });

    test('configured duration affects timer countdown in channels', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Configure BoR with 5 minute (300 seconds) duration
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        config.ServiceSettings.BurnOnReadDurationSeconds = 300; // 5 minutes
        config.ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds = 604800; // 7 days (so max TTL doesn't interfere)
        await adminClient.patchConfig(config);

        // # Verify the config was applied before proceeding (guard against state pollution)
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
                },
                {message: 'the server has the burn-on-read settings just patched'},
            )
            .toBe(true);

        // # Create a second user to receive the message
        const randomUser = await pw.random.user();
        const receiver = await adminClient.createUser(randomUser, '', '');
        receiver.password = randomUser.password;
        await adminClient.addToTeam(team.id, receiver.id);

        // # Create a private channel with sender and receiver
        const channelName = `bor-test-${Date.now().toString(36)}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: `BoR Duration Test ${channelName}`,
            type: 'P',
        } as any);
        await adminClient.addToChannel(receiver.id, channel.id);

        // # Log in as admin (sender) and post a BoR message
        const senderApp = await openChannel(pw, adminUser, {team, channel: channelName});
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 604800,
            },
        });
        await sendBorMessage(senderApp, `Duration test ${Date.now()}`);

        // # Log in as the receiver and find the concealed message
        const receiverApp = await openChannel(pw, receiver, {team, channel: channelName});
        const {post} = await concealedPost(receiverApp);
        await expect(post.revealButton).toBeVisible();
        // The placeholder's loading style has no equivalent generated state assertion.
        await expect(post.revealButton).not.toHaveClass(/BurnOnReadConcealedPlaceholder--loading/);
        await expect(post.revealButton).toBeEnabled();

        // Re-apply guard: TTL is set by the server at reveal time; ensure BurnOnReadDurationSeconds
        // is still 300 at the moment of reveal — a concurrent initSetup() may have reset it.
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 604800,
            },
        });

        // # Reveal it
        await reveal(post);

        // * Verify the timer shows about 5 minutes: between 4:10 (250s) and 5:00 (300s), allowing for test time
        await expect(post.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});
        const totalSeconds = await timeRemaining(post);
        expect(totalSeconds).toBeGreaterThanOrEqual(250);
        expect(totalSeconds).toBeLessThanOrEqual(300);
    });
});
