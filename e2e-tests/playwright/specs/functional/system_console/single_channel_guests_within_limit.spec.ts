// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * @objective Verify the server limits API returns single-channel guest count and limit for admin users
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled
 */
test(
    'returns single-channel guest data from server limits API for admin users',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminClient} = await pw.initSetup();

        // # Enable guest accounts
        const config = await adminClient.getConfig();
        config.GuestAccountsSettings.Enable = true;
        await adminClient.updateConfig(config);

        // # Fetch server limits
        const {data: limits} = await adminClient.getServerLimits();

        // * Verify the response includes single-channel guest fields
        expect(limits).toHaveProperty('singleChannelGuestCount');
        expect(limits).toHaveProperty('singleChannelGuestLimit');
        expect(typeof limits.singleChannelGuestCount).toBe('number');
        expect(typeof limits.singleChannelGuestLimit).toBe('number');
        expect(limits.singleChannelGuestCount).toBeGreaterThanOrEqual(0);
        expect(limits.singleChannelGuestLimit).toBeGreaterThanOrEqual(0);
    },
);

/**
 * @objective Verify the single-channel guests card does not show error styling when count is within limit
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled and guest count is within the allowed limit
 */
test(
    'shows no error styling on single-channel guests card when count is within limit',
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

        // # Create a single-channel guest (count will be well within any license limit)
        const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(guestUser.id, 'system_guest');
        await adminClient.addToTeam(team.id, guestUser.id);

        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'guest-no-overage',
                displayName: 'Guest No Overage',
                unique: true,
            }),
        );
        await adminClient.addToChannel(guestUser.id, channel.id);

        // # Navigate to site statistics
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the card title does NOT have error class (count is within limit)
        const cardTitle = systemConsolePage.page.getByTestId('singleChannelGuestsTitle');
        await expect(cardTitle).toBeVisible();
        await expect(cardTitle).not.toHaveClass(/team_statistics--error/);
    },
);

/**
 * @objective Verify the dismissible banner is not shown when single-channel guest count is within limit
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled and guest count is within the allowed limit
 */
test('does not show guest limit banner when count is within limit', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Enable guest accounts
    const config = await adminClient.getConfig();
    config.GuestAccountsSettings.Enable = true;
    await adminClient.updateConfig(config);

    // # Navigate to any page as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify the guest limit banner is not visible (count is within limit)
    await expect(systemConsolePage.page.getByTestId('single_channel_guest_limit_banner')).not.toBeVisible();
});
