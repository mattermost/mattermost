// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {expect, test, testConfig} from '@mattermost/playwright-lib';

/**
 * E2E coverage for the "Revoke non-compliant tokens" admin console control added in
 * MM-69075 (System Console > Integrations > Integration Management).
 *
 * A token is non-compliant once ServiceSettings.MaximumPersonalAccessTokenLifetimeDays > 0
 * and the token never expires, or expires beyond that cap. The policy only applies at
 * creation time, so every seeded token below is created before the cap is patched in.
 * Bot account tokens are exempt regardless of the policy.
 *
 * The non-compliant count and revoke operation are global (every user's tokens, not just
 * the test's own), and this server is shared across concurrently running tests/workers.
 * So assertions here check per-token outcomes (does this specific token still authenticate)
 * and UI state transitions (enabled/disabled, which banner mode) rather than exact global
 * counts, which would be flaky. See commit 56716c3616 for the same lesson learned in the
 * server-side store tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_ROLES = 'system_user system_user_access_token';

// Returns whether the given personal access token can still authenticate. The token
// secret is only present on the UserAccessToken returned at creation time.
async function tokenIsUsable(token: string | undefined): Promise<boolean> {
    if (!token) {
        throw new Error('Expected a token secret, but none was returned by createUserAccessToken');
    }

    const client = new Client4();
    client.setUrl(testConfig.baseURL);
    client.setToken(token);
    try {
        await client.getMe();
        return true;
    } catch {
        return false;
    }
}

test.describe('System Console > Integrations > Revoke non-compliant tokens @system_console', () => {
    test('disables the button and shows a compliant banner when no policy is configured', async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: 0},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 0;
        });

        // # A never-expiring token is fine while there is no cap
        const token = await adminClient.createUserAccessToken(user.id, 'never expires token');

        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.integrations.integrationManagement.click();
        await page.waitForURL(/\/admin_console\/integrations\/integration_management/);

        const section = page.getByTestId('sysconsole_section_CustomIntegrationSettings');
        await expect(section).toBeVisible();

        // * With no policy configured the server-side count is always 0 (nothing is
        // "non-compliant" without a cap to violate), so the button is deterministically disabled
        await expect(section.getByText('No personal access tokens currently need to be revoked.')).toBeVisible();
        await expect(section.getByRole('button', {name: 'Revoke non-compliant tokens'})).toBeDisabled();
        expect(await tokenIsUsable(token.token)).toBe(true);
    });

    test('shows a violation and reveals a confirmation modal that can be dismissed without revoking', async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed a never-expiring token while there is no cap, then enable the cap so it becomes non-compliant
        const token = await adminClient.createUserAccessToken(user.id, 'never expires token');
        await adminClient.patchConfig({ServiceSettings: {MaximumPersonalAccessTokenLifetimeDays: 30}});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30;
        });

        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.integrations.integrationManagement.click();
        await page.waitForURL(/\/admin_console\/integrations\/integration_management/);

        const section = page.getByTestId('sysconsole_section_CustomIntegrationSettings');
        await expect(section).toBeVisible();

        // * At least one violation is now shown (ours), and the button is enabled
        await expect(
            section.getByText(/\d+ personal access tokens? currently violates? the maximum lifetime policy\./),
        ).toBeVisible();
        const revokeButton = section.getByRole('button', {name: 'Revoke non-compliant tokens'});
        await expect(revokeButton).toBeEnabled();

        // # Open the confirmation and cancel it
        await revokeButton.click();
        const confirmModal = page.locator('#confirmModal');
        await expect(confirmModal.getByText('Revoke non-compliant personal access tokens?')).toBeVisible();
        await expect(confirmModal.getByText(/This will permanently revoke \d+ personal access tokens?/)).toBeVisible();
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).toBeHidden();

        // * Cancelling did not revoke our token
        expect(await tokenIsUsable(token.token)).toBe(true);
    });

    test('revokes non-compliant tokens on confirm, invalidating them while compliant and bot tokens survive', async ({
        pw,
    }) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, EnableBotAccountCreation: true},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed one non-compliant token, one compliant token, and one exempt bot token, all
        // # before the cap is enabled so the server allows their creation.
        const nonCompliantToken = await adminClient.createUserAccessToken(user.id, 'never expires token');
        const compliantToken = await adminClient.createUserAccessToken(
            user.id,
            'compliant token',
            Date.now() + 10 * DAY_MS,
        );
        const bot = await adminClient.createBot({
            username: `revoke-bot-${user.id.slice(0, 8)}`,
            display_name: 'Revoke test bot',
        });
        const botToken = await adminClient.createUserAccessToken(bot.user_id, 'bot token');

        await adminClient.patchConfig({ServiceSettings: {MaximumPersonalAccessTokenLifetimeDays: 30}});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30;
        });

        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.integrations.integrationManagement.click();
        await page.waitForURL(/\/admin_console\/integrations\/integration_management/);

        const section = page.getByTestId('sysconsole_section_CustomIntegrationSettings');
        await expect(section).toBeVisible();

        // # Confirm the revoke
        await section.getByRole('button', {name: 'Revoke non-compliant tokens'}).click();
        const confirmModal = page.locator('#confirmModal');
        await confirmModal.getByRole('button', {name: 'Revoke tokens'}).click();

        // * The success banner reports how many were revoked, and the button disables again
        // (nothing left to revoke, since a revoke sweeps every non-compliant token server-wide)
        await expect(section.getByText(/Revoked \d+ non-compliant personal access tokens?\./)).toBeVisible();
        await expect(section.getByRole('button', {name: 'Revoke non-compliant tokens'})).toBeDisabled();

        // * The non-compliant token can no longer authenticate
        await expect(async () => {
            expect(await tokenIsUsable(nonCompliantToken.token)).toBe(false);
        }).toPass();

        // * The compliant token and the exempt bot token still authenticate
        expect(await tokenIsUsable(compliantToken.token)).toBe(true);
        expect(await tokenIsUsable(botToken.token)).toBe(true);
    });

    test('refreshes the violation banner after saving a new maximum lifetime policy from the same page', async ({
        pw,
    }) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: 0},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed a never-expiring token while there is no cap
        const token = await adminClient.createUserAccessToken(user.id, 'never expires token');

        const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.integrations.integrationManagement.click();
        await page.waitForURL(/\/admin_console\/integrations\/integration_management/);

        const section = page.getByTestId('sysconsole_section_CustomIntegrationSettings');
        await expect(section).toBeVisible();

        // # Set a maximum lifetime and save, without leaving the page
        const maxLifetimeInput = section.getByTestId('ServiceSettings.MaximumPersonalAccessTokenLifetimeDaysnumber');
        await maxLifetimeInput.fill('30');
        await section.getByRole('button', {name: 'Save'}).click();

        // * The banner refreshes to flag the newly non-compliant token, without a page reload
        await expect(
            section.getByText(/\d+ personal access tokens? currently violates? the maximum lifetime policy\./),
        ).toBeVisible();
        await expect(section.getByRole('button', {name: 'Revoke non-compliant tokens'})).toBeEnabled();
        expect(await tokenIsUsable(token.token)).toBe(true);
    });
});
