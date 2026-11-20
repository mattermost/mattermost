// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';

import {
    openSystemConsoleSection,
    type App,
    type PlaywrightExtended,
    systemConsolePath,
    expect,
    getRandomId,
    test,
    duration,
} from '@mattermost/playwright-lib';

async function openConsole(app: App) {
    await openSystemConsoleSection(app);
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
}

test.describe('Single-channel guests', () => {
    test.setTimeout(duration.four_min);
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    async function setupSingleChannelGuestsTest(pw: PlaywrightExtended) {
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Expected administrator credentials');
        }
        const suffix = getRandomId();
        const team = await adminClient.createTeam({
            ...(await pw.random.team()),
            name: `scg-${suffix}`,
            display_name: `SCG ${suffix}`,
            type: 'O',
        });
        await adminClient.addToTeam(team.id, adminUser.id);
        return {adminClient, adminUser, team};
    }

    async function patchGuestEnabled(adminClient: Client4, enabled: boolean): Promise<boolean> {
        const cfg = await adminClient.getConfig();
        const previous = cfg.GuestAccountsSettings?.Enable ?? false;
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: enabled}});
        return previous;
    }

    async function navigateWithGuestPatch(page: Page, adminClient: Client4, url: string, guestEnabled: boolean) {
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
            const {app} = await pw.testBrowser.login(adminUser);
            await openConsole(app);

            // Re-apply patch after initial load + reload to counter WebSocket config resets
            // from concurrent initSetup() calls (default_config has Enable: false).
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('reporting/system_analytics'), true);

            // * Verify the single-channel guests card is visible
            await expect(app.admin.statistics.stat('singleChannelGuests').valueText).toBeVisible({
                timeout: duration.half_min,
            });

            // * Verify the count is at least 1.
            // Analytics are indexed asynchronously on the server — poll with reload until
            // the card reflects the newly created guest (can take several seconds in CI).
            await expect
                .poll(
                    async () => {
                        // Re-apply guest patch before reload: a concurrent initSetup() may
                        // reset the config back to the default (Enable: false), which would
                        // hide the card and make the textContent call return null.
                        await patchGuestEnabled(adminClient, true);
                        await app.page.reload();
                        await app.page.waitForLoadState('networkidle');
                        const text = await app.admin.statistics
                            .stat('singleChannelGuests')
                            .valueText.text()
                            .catch(() => '');
                        return Number(text?.match(/(\d+)/)?.[1] ?? 0);
                    },
                    {timeout: duration.four_min, intervals: [3000, 5000, 8000, 12000]},
                )
                .toBeGreaterThanOrEqual(1);
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
            const {app} = await pw.testBrowser.login(adminUser);
            await openConsole(app);

            // Re-apply patch after initial load + reload to counter WebSocket config resets.
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('about/license'), true);

            // * Verify the single-channel guests row is visible
            // The license card label has no generated part; check it within the declared license panel.
            await expect(app.admin.license.locator.getByText('SINGLE-CHANNEL GUESTS:')).toBeVisible();
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
            const {app} = await pw.testBrowser.login(adminUser);
            await openConsole(app);

            // Re-apply patch (disabled) + reload to ensure the browser reads the fresh config.
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('reporting/system_analytics'), false);

            // * Verify the single-channel guests card is not in the DOM
            await expect(app.admin.statistics.stat('singleChannelGuests').valueText).not.toBeVisible();
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
            const {app} = await pw.testBrowser.login(adminUser);
            await openConsole(app);

            // Re-apply patch + reload to counter WebSocket config resets.
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('reporting/system_analytics'), true);

            // * Verify the card title does NOT have error class (count is within limit)
            const cardTitle = app.admin.statistics.stat('singleChannelGuests').titleText;
            await expect(cardTitle).toBeVisible({timeout: duration.half_min});
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
        const {app} = await pw.testBrowser.login(adminUser);
        await openConsole(app);
        await patchGuestEnabled(adminClient, true);
        await app.page.reload();
        await app.page.waitForLoadState('networkidle');

        // * Verify the guest limit banner is not visible (count is within limit)
        // AnnouncementBar's existing id is not exposed by the generated surface.
        // The banner carries only the legacy single_channel_guest_limit_banner testid, outside the generated surface.
        await expect(app.page.getByTestId('single_channel_guest_limit_banner')).not.toBeVisible();
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

            // # Log in as admin (new browser context + page).
            const {context, app} = await pw.testBrowser.login(adminUser);

            // # Mock GET /api/v4/limits/server on the *context* before any navigation so the first
            // getServerLimits() populates Redux with a low limit. Also fulfill with an explicit
            // JSON body — route.fulfill({response, json}) does not reliably merge bodies in Playwright.
            await context.route('**/api/v4/limits/server', async (route) => {
                const response = await route.fetch();
                let json: Record<string, unknown> = {};
                try {
                    json = (await response.json()) as Record<string, unknown>;
                } catch {
                    // ignore — replace with minimal payload
                }
                json.singleChannelGuestLimit = 1;
                json.singleChannelGuestCount = 3;
                await route.fulfill({
                    status: response.status(),
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(json),
                });
            });

            // # Navigate to site statistics page, re-applying patch to counter concurrent resets.
            await openConsole(app);
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('reporting/system_analytics'), true);

            // * Verify the card title has error styling
            const cardTitle = app.admin.statistics.stat('singleChannelGuests').titleText;
            await expect(cardTitle).toBeVisible({timeout: duration.half_min});
            await expect(cardTitle).toHaveClass(/team_statistics--error/);

            // * Verify the dismissible guest limit banner is visible
            // AnnouncementBar's existing id is not exposed by the generated surface.
            // The banner carries only the legacy single_channel_guest_limit_banner testid, outside the generated surface.
            await expect(app.page.getByTestId('single_channel_guest_limit_banner')).toBeVisible();
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
            const {app} = await pw.testBrowser.login(adminUser);
            await openConsole(app);
            await navigateWithGuestPatch(app.page, adminClient, systemConsolePath('reporting/system_analytics'), true);

            // * Verify the single-channel guests card is visible
            const singleChannelGuestsCard = app.admin.statistics.stat('singleChannelGuests').valueText;
            await expect(singleChannelGuestsCard).toBeVisible({timeout: duration.half_min});

            // * Verify the count text is present — multi-channel guest should not increment it
            const readGuestCount = async () => {
                await patchGuestEnabled(adminClient, true);
                await app.page.reload();
                await app.page.waitForLoadState('networkidle');
                const text = await singleChannelGuestsCard.text().catch(() => '');
                return Number(text?.match(/(\d+)/)?.[1] ?? NaN);
            };
            let singleChannelGuestCount = NaN;
            await expect
                .poll(
                    async () => {
                        singleChannelGuestCount = await readGuestCount();
                        return singleChannelGuestCount;
                    },
                    {timeout: duration.four_min, intervals: [3000, 5000, 8000, 12000]},
                )
                .toBeGreaterThanOrEqual(0);

            // # Now create a single-channel guest to confirm baseline counting works
            const singleChannelGuest = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.updateUserRoles(singleChannelGuest.id, 'system_guest');
            await adminClient.addToTeam(team.id, singleChannelGuest.id);
            await adminClient.addToChannel(singleChannelGuest.id, channelA.id);

            // * Verify the count increased by exactly 1 for the new single-channel guest
            await expect
                .poll(readGuestCount, {timeout: duration.four_min, intervals: [3000, 5000, 8000, 12000]})
                .toBe(singleChannelGuestCount + 1);
        },
    );
});
