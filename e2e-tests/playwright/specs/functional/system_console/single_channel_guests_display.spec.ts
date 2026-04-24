// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * @objective Verify the Single-channel Guests stat card appears on the Site Statistics page when guests are enabled
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled
 */
test(
    'displays single-channel guests card on site statistics page when guest accounts are enabled',
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

        // # Create a guest user and add to one channel
        const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(guestUser.id, 'system_guest');
        await adminClient.addToTeam(team.id, guestUser.id);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: 'guest-channel', displayName: 'Guest Channel', unique: true}),
        );
        await adminClient.addToChannel(guestUser.id, channel.id);

        // # Log in as admin and navigate to site statistics
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the single-channel guests card is visible
        const singleChannelGuestsCard = systemConsolePage.page.getByTestId('singleChannelGuests');
        await expect(singleChannelGuestsCard).toBeVisible();

        // * Verify the count is at least 1
        const countText = await singleChannelGuestsCard.textContent();
        const match = countText?.match(/(\d+)/);
        expect(match).toBeTruthy();
        expect(Number(match![1])).toBeGreaterThanOrEqual(1);
    },
);

/**
 * @objective Verify the Single-channel Guests row appears on the Edition and License page when guests are enabled
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled and a single-channel guest limit configured
 */
test(
    'displays single-channel guests row on edition and license page when guest accounts are enabled',
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

        // # Create a guest user and add to one channel
        const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(guestUser.id, 'system_guest');
        await adminClient.addToTeam(team.id, guestUser.id);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: 'guest-channel', displayName: 'Guest Channel', unique: true}),
        );
        await adminClient.addToChannel(guestUser.id, channel.id);

        // # Log in as admin and navigate to edition and license page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/about/license');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the single-channel guests row is visible
        await expect(systemConsolePage.page.getByText('SINGLE-CHANNEL GUESTS:')).toBeVisible();
    },
);

/**
 * @objective Verify the Single-channel Guests stat card is not shown when guest accounts are disabled
 */
test(
    'hides single-channel guests card on site statistics page when guest accounts are disabled',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Disable guest accounts
        const config = await adminClient.getConfig();
        config.GuestAccountsSettings.Enable = false;
        await adminClient.updateConfig(config);

        // # Log in as admin and navigate to site statistics
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the single-channel guests card is not in the DOM
        await expect(systemConsolePage.page.getByTestId('singleChannelGuests')).not.toBeVisible();
    },
);
