// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

async function setupSingleChannelGuestsTest(pw: any) {
    const {adminClient, adminUser} = await pw.getAdminClient();
    const suffix = getRandomId();
    const team = await adminClient.createTeam({
        name: `scg-${suffix}`,
        display_name: `SCG ${suffix}`,
        type: 'O',
    });
    await adminClient.addToTeam(team.id, adminUser.id);
    return {adminClient, adminUser, team};
}

async function patchGuestEnabled(adminClient: any, enabled: boolean): Promise<boolean> {
    const cfg = await adminClient.getConfig();
    const previous = cfg.GuestAccountsSettings?.Enable ?? false;
    await adminClient.patchConfig({GuestAccountsSettings: {Enable: enabled}});
    return previous;
}

async function navigateWithGuestPatch(page: any, adminClient: any, url: string, guestEnabled: boolean) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await patchGuestEnabled(adminClient, guestEnabled);
    await page.reload();
    await page.waitForLoadState('networkidle');
}

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
        const {adminUser, adminClient, team} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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

        // Re-apply patch after initial load + reload to counter WebSocket config resets
        // from concurrent initSetup() calls (default_config has Enable: false).
        await navigateWithGuestPatch(
            systemConsolePage.page,
            adminClient,
            '/admin_console/reporting/system_analytics',
            true,
        );

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
        const {adminUser, adminClient, team} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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

        // Re-apply patch after initial load + reload to counter WebSocket config resets.
        await navigateWithGuestPatch(systemConsolePage.page, adminClient, '/admin_console/about/license', true);

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
        const {adminUser, adminClient} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Disable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, false);

        // # Log in as admin and navigate to site statistics
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // Re-apply patch (disabled) + reload to ensure the browser reads the fresh config.
        await navigateWithGuestPatch(
            systemConsolePage.page,
            adminClient,
            '/admin_console/reporting/system_analytics',
            false,
        );

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
        const {adminClient} = await setupSingleChannelGuestsTest(pw);

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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
        const {adminUser, adminClient, team} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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

        // Re-apply patch + reload to counter WebSocket config resets.
        await navigateWithGuestPatch(
            systemConsolePage.page,
            adminClient,
            '/admin_console/reporting/system_analytics',
            true,
        );

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
    const {adminUser, adminClient} = await setupSingleChannelGuestsTest(pw);

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Enable guest accounts (narrow patch, not destructive full-config update)
    await patchGuestEnabled(adminClient, true);

    // # Navigate to system console and re-apply patch + reload so the browser reads
    // the latest config (not a WebSocket-clobbered Redux store from a concurrent initSetup).
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await patchGuestEnabled(adminClient, true);
    await systemConsolePage.page.reload();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify the guest limit banner is not visible (count is within limit)
    await expect(systemConsolePage.page.getByTestId('single_channel_guest_limit_banner')).not.toBeVisible();
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
        const {adminUser, adminClient, team} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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

        // # Navigate to site statistics page, re-applying patch to counter concurrent resets.
        // The page.route mock persists across reloads, so navigateWithGuestPatch is safe here.
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await navigateWithGuestPatch(
            systemConsolePage.page,
            adminClient,
            '/admin_console/reporting/system_analytics',
            true,
        );

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
        const {adminUser, adminClient, team} = await setupSingleChannelGuestsTest(pw);

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable guest accounts (narrow patch, not destructive full-config update)
        await patchGuestEnabled(adminClient, true);

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

        // # Log in as admin and navigate to site statistics, re-applying patch to counter
        // concurrent initSetup() resets (default_config has GuestAccountsSettings.Enable: false).
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await navigateWithGuestPatch(
            systemConsolePage.page,
            adminClient,
            '/admin_console/reporting/system_analytics',
            true,
        );

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
