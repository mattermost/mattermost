// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getBurnOnReadSettings, gotoPostSettings, skipIfNotAdvancedLicense} from './support';

test.describe('System Console > Self-Deleting Messages', () => {
    test('admin can configure message duration', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

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
        await gotoPostSettings(systemConsolePage, page);

        const {durationDropdown, saveButton} = getBurnOnReadSettings(page);

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
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

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
        await gotoPostSettings(systemConsolePage, page);

        const {maxTTLDropdown, saveButton} = getBurnOnReadSettings(page);

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

    test('configured duration affects timer countdown in channels', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        skipIfNotAdvancedLicense(license);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Configure BoR with 5 minute (300 seconds) duration
        const config = await adminClient.getConfig();
        config.ServiceSettings.EnableBurnOnRead = true;
        config.ServiceSettings.BurnOnReadDurationSeconds = 300; // 5 minutes
        config.ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds = 604800; // 7 days (so max TTL doesn't interfere)
        await adminClient.patchConfig(config);

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
