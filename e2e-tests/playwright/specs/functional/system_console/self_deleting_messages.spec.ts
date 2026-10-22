// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

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
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        // * Verify Posts section is visible
        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        await expect(postsSection).toBeVisible();

        // Get BoR setting elements
        const enableToggleTrue = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        const enableToggleFalse = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadfalse');
        const durationDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        const maxTTLDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown');
        const saveButton = postsSection.getByRole('button', {name: 'Save'});

        // # If feature is enabled, disable it first
        if (await enableToggleTrue.isChecked()) {
            await enableToggleFalse.click();
            await saveButton.click();
            await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');
        }

        // * Verify dropdowns are disabled when feature is off
        expect(await durationDropdown.isDisabled()).toBe(true);
        expect(await maxTTLDropdown.isDisabled()).toBe(true);

        // # Enable the feature
        await enableToggleTrue.click();

        // * Verify feature is enabled
        expect(await enableToggleTrue.isChecked()).toBe(true);

        // * Verify dropdowns are now enabled
        expect(await durationDropdown.isDisabled()).toBe(false);
        expect(await maxTTLDropdown.isDisabled()).toBe(false);

        // # Save settings
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate away and back to verify persistence
        await systemConsolePage.sidebar.userManagement.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        // * Verify feature is still enabled
        expect(await enableToggleTrue.isChecked()).toBe(true);
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
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const durationDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        const saveButton = postsSection.getByRole('button', {name: 'Save'});

        // # Select 60 seconds duration
        await durationDropdown.selectOption('60');

        // # Save settings
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate away and back
        await systemConsolePage.sidebar.userManagement.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        // * Verify duration is still 60 seconds
        expect(await durationDropdown.inputValue()).toBe('60');
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
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const maxTTLDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown');
        const saveButton = postsSection.getByRole('button', {name: 'Save'});

        // # Select 1 day (86400 seconds) max TTL
        await maxTTLDropdown.selectOption('86400');

        // # Save settings
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // # Navigate away and back
        await systemConsolePage.sidebar.userManagement.users.click();
        await systemConsolePage.users.toBeVisible();
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        // * Verify max TTL is still 1 day
        expect(await maxTTLDropdown.inputValue()).toBe('86400');
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
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableBurnOnRead === false;
        });

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const enableToggleTrue = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        const enableToggleFalse = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadfalse');
        const durationDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        const maxTTLDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown');

        // * Verify feature is disabled (from API config) — use built-in retry to tolerate render lag
        await expect(enableToggleFalse).toBeChecked({timeout: 10000});

        // * Verify dropdowns are disabled when feature is off
        await expect(durationDropdown).toBeDisabled({timeout: 30000});
        await expect(maxTTLDropdown).toBeDisabled({timeout: 30000});

        // # Enable the feature (just toggle, don't save)
        await enableToggleTrue.click();

        // * Verify dropdowns are now enabled
        await expect(durationDropdown).not.toBeDisabled({timeout: 30000});
        await expect(maxTTLDropdown).not.toBeDisabled({timeout: 30000});

        // # Toggle back to disabled
        await enableToggleFalse.click();

        // * Verify dropdowns are disabled again
        await expect(durationDropdown).toBeDisabled({timeout: 30000});
        await expect(maxTTLDropdown).toBeDisabled({timeout: 30000});
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
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
        });

        // # Log in as admin
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const enableToggleTrue = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        const durationDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        const maxTTLDropdown = postsSection.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown');

        // * Verify configured values are displayed
        expect(await enableToggleTrue.isChecked()).toBe(true);
        expect(await durationDropdown.inputValue()).toBe('300');
        expect(await maxTTLDropdown.inputValue()).toBe('259200');

        // Re-apply guard: a concurrent initSetup() may reset BoR config between
        // the initial page load and this reload.
        await adminClient.patchConfig({
            ServiceSettings: {
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 259200,
            },
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
        });

        // # Reload directly to Posts section
        await page.goto('/admin_console/site_config/posts');
        await page.waitForLoadState('networkidle');

        // * Verify values persist after reload — toHaveValue has built-in retry
        await expect(enableToggleTrue).toBeChecked({timeout: 5000});
        await expect(durationDropdown).toHaveValue('300', {timeout: 5000});
        await expect(maxTTLDropdown).toHaveValue('259200', {timeout: 5000});
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
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const enableToggleTrue = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        const saveButton = postsSection.getByRole('button', {name: 'Save'});

        // # Enable BoR feature
        await enableToggleTrue.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // Re-apply guard: concurrent initSetup() may reset EnableBurnOnRead between UI save and navigation
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: true}});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.EnableBurnOnRead === true;
        });

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await page.waitForLoadState('networkidle');

        // * Verify BoR toggle is visible in post create area
        const borButton = page.getByRole('button', {name: /Burn-on-read/i});
        await expect(borButton).toBeVisible({timeout: 10000});
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
        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Posts section
        await systemConsolePage.sidebar.siteConfiguration.posts.click();
        await page.waitForLoadState('networkidle');

        const postsSection = page.getByTestId('sysconsole_section_PostSettings');
        const enableToggleFalse = postsSection.getByTestId('ServiceSettings.EnableBurnOnReadfalse');
        const saveButton = postsSection.getByRole('button', {name: 'Save'});

        // # Disable BoR feature
        await enableToggleFalse.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // Re-apply guard: concurrent initSetup() may re-enable BoR between UI save and navigation
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: false}});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.EnableBurnOnRead === false;
        });

        // # Navigate to Channels by going to the team URL
        await page.goto(`/${team.name}/channels/off-topic`);
        await page.waitForLoadState('networkidle');

        // * Verify BoR toggle is NOT visible in post create area
        const borButton = page.getByRole('button', {name: /Burn-on-read/i});
        await expect(borButton).not.toBeVisible({timeout: 5000});
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
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 300;
        });

        // # Create a second user to receive the message
        const randomUser = await pw.random.user();
        const receiver = await adminClient.createUser(randomUser, '', '');
        (receiver as any).password = randomUser.password;
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

        // # Login as admin (sender) and post BoR message
        const {channelsPage: senderChannelsPage} = await pw.testBrowser.login(adminUser);
        await senderChannelsPage.goto(team.name, channelName);
        await senderChannelsPage.toBeVisible();
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 604800,
            },
        });

        // # Toggle BoR on and post message
        await senderChannelsPage.centerView.postCreate.toggleBurnOnRead();
        const messageContent = `Duration test ${Date.now()}`;
        await senderChannelsPage.postMessage(messageContent);

        // # Login as receiver and reveal the message
        const {channelsPage: receiverChannelsPage, page: receiverPage} = await pw.testBrowser.login(receiver as any);
        await receiverChannelsPage.goto(team.name, channelName);
        await receiverChannelsPage.toBeVisible();

        // # Wait for the concealed placeholder to be visible and enabled (not loading)
        const concealedPlaceholder = receiverPage.locator('.BurnOnReadConcealedPlaceholder').first();
        await expect(concealedPlaceholder).toBeVisible({timeout: 10000});

        // Wait for it to not be in loading state
        await expect(concealedPlaceholder).not.toHaveClass(/BurnOnReadConcealedPlaceholder--loading/, {timeout: 10000});
        await expect(concealedPlaceholder).toBeEnabled({timeout: 5000});

        // Re-apply guard: TTL is set by the server at reveal time; ensure BurnOnReadDurationSeconds
        // is still 300 at the moment of reveal — a concurrent initSetup() may have reset it.
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 300,
                BurnOnReadMaximumTimeToLiveSeconds: 604800,
            },
        });

        // # Click to reveal the concealed message
        await concealedPlaceholder.click();

        // # Confirm reveal in modal if it appears
        const confirmModal = receiverPage.locator('.BurnOnReadConfirmationModal');
        if (await confirmModal.isVisible({timeout: 2000}).catch(() => false)) {
            const confirmButton = confirmModal.getByRole('button', {name: /reveal/i});
            await confirmButton.click();
        }

        // * Verify timer chip shows approximately 5 minutes (between 4:10 and 5:00)
        const timerChip = receiverPage.locator('.BurnOnReadTimerChip').first();
        await expect(timerChip).toBeVisible({timeout: 15000});

        const timerText = await timerChip.textContent();
        // Timer format is "M:SS" or "MM:SS", should be close to 5:00
        const match = timerText?.match(/(\d+):(\d{2})/);
        expect(match).not.toBeNull();

        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const totalSeconds = minutes * 60 + seconds;

            // Should be between 4:10 (250s) and 5:00 (300s) accounting for test execution time
            expect(totalSeconds).toBeGreaterThanOrEqual(250);
            expect(totalSeconds).toBeLessThanOrEqual(300);
        }
    });
});
