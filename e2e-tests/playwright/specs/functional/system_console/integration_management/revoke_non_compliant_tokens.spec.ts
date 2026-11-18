// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4, ClientError} from '@mattermost/client';

import {
    openSystemConsoleSection,
    Api,
    expect,
    Msg,
    settle,
    systemConsolePath,
    test,
    testConfig,
    type App,
} from '@mattermost/playwright-lib';

/**
 * E2E coverage for the "Revoke non-compliant tokens" admin console control added in
 * MM-69075 (System Console > Integrations > Integration Management).
 *
 * A token is non-compliant once ServiceSettings.MaximumPersonalAccessTokenLifetimeDays > 0
 * and the token never expires, or expires beyond that cap. The policy only applies at
 * creation time, so every test clears the cap before seeding its tokens and patches it in
 * afterwards. The cap is server-wide, so a test that already ran leaves it set.
 * User-owned bot account tokens are included; plugin-owned bot account tokens are exempt.
 * A bot created via the REST API is always owned by the creating user, so the plugin-owned
 * case is covered by the server-side tests rather than here.
 *
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_ROLES = 'system_user system_user_access_token';

// Returns whether the given personal access token can still authenticate: a revoked or expired token is
// refused with 401, any other failure is a real error. The token secret is only present on the
// UserAccessToken returned at creation time.
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
    } catch (error) {
        if (error instanceof ClientError && error.status_code === 401) {
            return false;
        }
        throw error;
    }
}

/** Opens System Console > Integrations > Integration Management through the sidebar. */
async function openIntegrationManagement(app: App) {
    await openSystemConsoleSection(app);
    await app.admin.sidebar.category('integrations').section('integration_management').titleLink.click();
    await expect(app.page).toHavePath(systemConsolePath('integrations/integration_management'));
    await expect(app.admin.screen('CustomIntegrationSettings')).toBeVisible();
    return app.admin.revokeTokens;
}

const VIOLATION = /\d+ personal access tokens? currently violates? the maximum lifetime policy\./;

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

        const {app} = await pw.testBrowser.login(adminUser);
        const revoke = await openIntegrationManagement(app);

        // * With no policy configured the server-side count is always 0 (nothing is
        // "non-compliant" without a cap to violate), so the button is deterministically disabled
        await expect(revoke.status).toContainMessage(Msg.admin.service.revokeNonCompliantTokens.none);
        await expect(revoke.status).toBeVisible();
        await expect(revoke.revokeButton).toBeDisabled();
        expect(await tokenIsUsable(token.token)).toBe(true);
    });

    test('shows a violation and reveals a confirmation modal that can be dismissed without revoking', async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: 0},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed a never-expiring token while there is no cap, then enable the cap so it becomes non-compliant
        const token = await adminClient.createUserAccessToken(user.id, 'never expires token');
        await adminClient.patchConfig({ServiceSettings: {MaximumPersonalAccessTokenLifetimeDays: 30}});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30;
        });

        const {app} = await pw.testBrowser.login(adminUser);
        const revoke = await openIntegrationManagement(app);

        // * At least one violation is now shown (ours), and the button is enabled
        await expect(revoke.status).toContainText(VIOLATION);
        await expect(revoke.status).toBeVisible();
        await expect(revoke.revokeButton).toBeEnabled();

        // # Open the confirmation and cancel it
        await revoke.revokeButton.click();
        const confirmModal = app.admin.revokeNonCompliantTokensModal;
        await expect(confirmModal).toContainMessage(Msg.admin.service.revokeNonCompliantTokens.confirmTitle);
        await expect(confirmModal).toBeVisible();
        await expect(confirmModal).toContainText(/This will permanently revoke \d+ personal access tokens?/);
        await expect(confirmModal).toBeVisible();
        await confirmModal.cancelButton.click();
        await expect(confirmModal.cancelButton).toBeHidden();

        // * Cancelling did not revoke our token
        expect(await tokenIsUsable(token.token)).toBe(true);
    });

    test('revokes non-compliant tokens on confirm, invalidating human and user-owned bot tokens while compliant tokens survive', async ({
        pw,
    }) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                EnableBotAccountCreation: true,
                MaximumPersonalAccessTokenLifetimeDays: 0,
            },
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed one non-compliant token, one compliant token, and one user-owned bot token,
        // # all before the cap is enabled so the server allows their creation.
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

        const {app} = await pw.testBrowser.login(adminUser);
        const revoke = await openIntegrationManagement(app);

        // # Confirm the revoke
        await revoke.revokeButton.click();
        const confirmModal = app.admin.revokeNonCompliantTokensModal;
        await expect(confirmModal.confirmButton).toHaveMessage(
            Msg.admin.service.revokeNonCompliantTokens.confirmButton,
        );
        await expect(confirmModal.confirmButton).toBeVisible();
        await settle(confirmModal.confirmButton, {wait: Api.RevokeNonCompliantUserAccessTokens}).click();

        // * The success banner reports how many were revoked, and the button disables again
        // (nothing left to revoke, since a revoke sweeps every non-compliant token server-wide)
        await expect(revoke.revoked).toContainText(/Revoked \d+ non-compliant personal access tokens?\./);
        await expect(revoke.revoked).toBeVisible();
        await expect(revoke.revokeButton).toBeDisabled();

        // * The non-compliant token can no longer authenticate
        await expect(async () => {
            expect(await tokenIsUsable(nonCompliantToken.token)).toBe(false);
        }).toPass();

        // * The compliant token still authenticates, while the user-owned bot token is revoked.
        expect(await tokenIsUsable(compliantToken.token)).toBe(true);
        await expect(async () => {
            expect(await tokenIsUsable(botToken.token)).toBe(false);
        }).toPass();
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

        const {app} = await pw.testBrowser.login(adminUser);
        const revoke = await openIntegrationManagement(app);

        // # Set a maximum lifetime and save, without leaving the page
        await app.admin.setting('ServiceSettings.MaximumPersonalAccessTokenLifetimeDays').numberSpinButton.fill('30');
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * The banner refreshes to flag the newly non-compliant token, without a page reload
        await expect(revoke.status).toContainText(VIOLATION);
        await expect(revoke.status).toBeVisible();
        await expect(revoke.revokeButton).toBeEnabled();
        expect(await tokenIsUsable(token.token)).toBe(true);
    });
});
