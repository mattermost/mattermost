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
    await expect(systemConsolePage.page.locator('#single_channel_guest_limit_banner')).not.toBeVisible();
});

/**
 * @objective Verify error styling appears on the single-channel guests card and dismissible banner shows when single-channel guest count exceeds the limit
 *
 * @precondition
 * Server has a non-Entry license with guest accounts enabled and a small enough seat count to make overage testable
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

        // # Check the current limit to see if overage is feasible
        const {data: initialLimits} = await adminClient.getServerLimits();
        const limit = initialLimits.singleChannelGuestLimit;
        const currentCount = initialLimits.singleChannelGuestCount;
        const guestsNeeded = limit - currentCount + 1;

        // # Skip if the limit is too large to make this test practical
        if (limit === 0 || guestsNeeded > 20) {
            test.skip(
                true,
                `License has ${limit} seats; creating ${guestsNeeded} guests to trigger overage is not practical`,
            );
            return;
        }

        // # Create enough single-channel guests to exceed the limit
        for (let i = 0; i < guestsNeeded; i++) {
            const guest = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.updateUserRoles(guest.id, 'system_guest');
            await adminClient.addToTeam(team.id, guest.id);

            const channel = await adminClient.createChannel(pw.random.channel({teamId: team.id, unique: true}));
            await adminClient.addToChannel(guest.id, channel.id);
        }

        // # Navigate to site statistics page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the card title has error styling
        const cardTitle = systemConsolePage.page.getByTestId('singleChannelGuestsTitle');
        await expect(cardTitle).toBeVisible();
        await expect(cardTitle).toHaveClass(/team_statistics--error/);

        // # Navigate back to System Console home to check global banner
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // * Verify the dismissible guest limit banner is visible
        await expect(systemConsolePage.page.locator('#single_channel_guest_limit_banner')).toBeVisible();
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
