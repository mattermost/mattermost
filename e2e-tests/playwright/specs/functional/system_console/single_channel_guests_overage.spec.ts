// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * @objective Verify error styling appears on the single-channel guests card and dismissible banner shows when single-channel guest count exceeds the limit
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled
 */
test(
    'shows error styling on guests card and banner when single-channel guest count exceeds limit',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts
        const config = await adminClient.getConfig();
        config.GuestAccountsSettings.Enable = true;
        await adminClient.updateConfig(config);

        // # Create multiple single-channel guests so the analytics count exceeds the mocked limit
        for (let i = 0; i < 3; i++) {
            const guest = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.updateUserRoles(guest.id, 'system_guest');
            await adminClient.addToTeam(team.id, guest.id);

            const ch = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: `scg-overage-${i}`,
                    displayName: `SCG Overage ${i}`,
                    unique: true,
                }),
            );
            await adminClient.addToChannel(guest.id, ch.id);
        }

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Mock the server limits API to simulate overage by returning a limit of 1
        await systemConsolePage.page.route('**/api/v4/limits/server', async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            json.singleChannelGuestLimit = 1;
            await route.fulfill({response, json});
        });

        // # Navigate to site statistics page
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the card title has error styling
        const cardTitle = systemConsolePage.page.getByTestId('singleChannelGuestsTitle');
        await expect(cardTitle).toBeVisible();
        await expect(cardTitle).toHaveClass(/team_statistics--error/);

        // * Verify the dismissible guest limit banner is visible
        await expect(systemConsolePage.page.getByTestId('single_channel_guest_limit_banner')).toBeVisible();
    },
);

/**
 * @objective Verify that a guest in multiple channels is not counted as a single-channel guest
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled
 */
test(
    'does not count multi-channel guest as single-channel guest on site statistics page',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts
        const config = await adminClient.getConfig();
        config.GuestAccountsSettings.Enable = true;
        await adminClient.updateConfig(config);

        // # Create a guest user and add to TWO channels
        const multiChannelGuest = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(multiChannelGuest.id, 'system_guest');
        await adminClient.addToTeam(team.id, multiChannelGuest.id);

        const channelA = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'guest-channel-a',
                displayName: 'Guest Channel A',
                unique: true,
            }),
        );
        const channelB = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'guest-channel-b',
                displayName: 'Guest Channel B',
                unique: true,
            }),
        );
        await adminClient.addToChannel(multiChannelGuest.id, channelA.id);
        await adminClient.addToChannel(multiChannelGuest.id, channelB.id);

        // # Log in as admin and navigate to site statistics
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the single-channel guests card is visible
        const singleChannelGuestsCard = systemConsolePage.page.getByTestId('singleChannelGuests');
        await expect(singleChannelGuestsCard).toBeVisible();

        // * Verify the count text is present — multi-channel guest should not increment it
        const countText = await singleChannelGuestsCard.textContent();
        const match = countText?.match(/(\d+)/);
        expect(match).toBeTruthy();

        const singleChannelGuestCount = Number(match![1]);

        // # Now create a single-channel guest to confirm baseline counting works
        const singleChannelGuest = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(singleChannelGuest.id, 'system_guest');
        await adminClient.addToTeam(team.id, singleChannelGuest.id);
        await adminClient.addToChannel(singleChannelGuest.id, channelA.id);

        // # Reload page to get updated stats
        await systemConsolePage.page.reload();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the count increased by exactly 1 for the new single-channel guest
        const updatedCountText = await singleChannelGuestsCard.textContent();
        const updatedMatch = updatedCountText?.match(/(\d+)/);
        expect(updatedMatch).toBeTruthy();
        expect(Number(updatedMatch![1])).toBe(singleChannelGuestCount + 1);
    },
);
