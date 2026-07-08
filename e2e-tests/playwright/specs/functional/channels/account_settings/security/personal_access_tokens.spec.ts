// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * E2E coverage for the Personal Access Token (PAT) expiry UI added in MM-68421.
 *
 * Enforcement is implied by ServiceSettings.MaximumPersonalAccessTokenLifetimeDays:
 * 0 means tokens may never expire; a value > 0 requires every token to expire
 * within that many days (there is no separate "enforce expiry" flag on the server).
 *
 * The expired-status badge is intentionally not covered here: the server rejects
 * creating a token whose expiry is already in the past, so an expired token cannot
 * be seeded via the API. That branch is exercised by the component unit tests.
 */

const TOKEN_ROLES = 'system_user system_user_access_token';
const DAY_MS = 24 * 60 * 60 * 1000;

// YYYY-MM-DD, n days from today in local time (matches the <input type="date"> format).
function isoPlusDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

test.describe('Personal Access Tokens expiry @personal_access_tokens', () => {
    test('shows the expiry picker with all presets and reveals the custom date input', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableUserAccessTokens === true;
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open the Personal Access Tokens section and start creating a token
        const patSection = await channelsPage.openPersonalAccessTokensSection();
        await channelsPage.profileModal.container.getByRole('button', {name: 'Create Token'}).click();

        // * The expiry select offers "No expiry", every preset, and a custom option
        await expect(patSection.expirySelect).toBeVisible();
        await expect(patSection.getExpiryOption('No expiry')).toHaveCount(1);
        await expect(patSection.getExpiryOption('7 days')).toHaveCount(1);
        await expect(patSection.getExpiryOption('30 days')).toHaveCount(1);
        await expect(patSection.getExpiryOption('90 days')).toHaveCount(1);
        await expect(patSection.getExpiryOption('1 year')).toHaveCount(1);
        await expect(patSection.getExpiryOption(/Custom date/)).toHaveCount(1);

        // * The custom date input is hidden until the custom option is chosen
        await expect(patSection.customExpiryInput).toBeHidden();
        await patSection.expirySelect.selectOption('custom');
        await expect(patSection.customExpiryInput).toBeVisible();
    });

    test('blocks submitting a custom expiry with no date chosen', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableUserAccessTokens === true;
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const patSection = await channelsPage.openPersonalAccessTokensSection();
        await channelsPage.profileModal.container.getByRole('button', {name: 'Create Token'}).click();

        // # Provide a description, pick the custom preset, then clear the date
        await patSection.descriptionInput.fill('My token');
        await patSection.expirySelect.selectOption('custom');
        await patSection.customExpiryInput.fill('');

        // * The inline validation error surfaces and Save is disabled, so no token can be created
        await expect(channelsPage.profileModal.container.getByText('An expiry date is required.')).toBeVisible();
        await expect(channelsPage.profileModal.saveButton).toBeDisabled();
        await expect(channelsPage.profileModal.container.getByText('Access Token:')).toBeHidden();
    });

    test('enforces expiry when a maximum lifetime is configured', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: 30},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (
                cfg.ServiceSettings?.EnableUserAccessTokens === true &&
                cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30
            );
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const patSection = await channelsPage.openPersonalAccessTokensSection();
        await channelsPage.profileModal.container.getByRole('button', {name: 'Create Token'}).click();

        // * "No expiry" and presets longer than the maximum are hidden; the enforced hint shows
        await expect(patSection.getExpiryOption('No expiry')).toHaveCount(0);
        await expect(patSection.getExpiryOption('90 days')).toHaveCount(0);
        await expect(patSection.getExpiryOption('1 year')).toHaveCount(0);
        await expect(patSection.getExpiryOption('7 days')).toHaveCount(1);
        await expect(patSection.getExpiryOption('30 days')).toHaveCount(1);
        await expect(
            channelsPage.profileModal.container.getByText(
                'Your administrator requires all personal access tokens to have an expiry date.',
            ),
        ).toBeVisible();

        // # Choose a custom date beyond the configured maximum
        await patSection.descriptionInput.fill('My token');
        await patSection.expirySelect.selectOption('custom');
        await patSection.customExpiryInput.fill(isoPlusDays(60));

        // * The over-the-limit error surfaces inline and Save is disabled
        await expect(
            channelsPage.profileModal.container.getByText('Expiry can be at most 30 days from now.'),
        ).toBeVisible();
        await expect(channelsPage.profileModal.saveButton).toBeDisabled();
    });

    test('creates a token with the default preset under a maximum lifetime', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: 30},
        });
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (
                cfg.ServiceSettings?.EnableUserAccessTokens === true &&
                cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30
            );
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const patSection = await channelsPage.openPersonalAccessTokensSection();
        await channelsPage.profileModal.container.getByRole('button', {name: 'Create Token'}).click();

        // # Accept the default preset (which equals the cap) and save
        await patSection.descriptionInput.fill('My token');
        await channelsPage.profileModal.saveButton.click();

        // * The token is created (the server accepts the clamped expiry) and revealed
        await expect(channelsPage.profileModal.container.getByText('Access Token:')).toBeVisible();
        await expect(
            channelsPage.profileModal.container.getByText('Expiry can be at most 30 days from now.'),
        ).toBeHidden();
    });

    test('shows status and expiry for existing tokens', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableUserAccessTokens === true;
        });

        // # Seed three tokens for the user: never-expiring, expiring soon, and disabled
        await adminClient.createUserAccessToken(user.id, 'never expires token');
        await adminClient.createUserAccessToken(user.id, 'expiring soon token', Date.now() + 3 * DAY_MS);
        const disabledToken = await adminClient.createUserAccessToken(user.id, 'disabled token');
        await adminClient.disableUserAccessToken(disabledToken.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const patSection = await channelsPage.openPersonalAccessTokensSection();

        // * The never-expiring token is Active and shows "Never"
        const neverRow = patSection.getTokenRow('never expires token');
        await expect(neverRow.getByText('Active')).toBeVisible();
        await expect(neverRow.getByText(/Never/)).toBeVisible();

        // * The soon-expiring token is Active and shows an "expires in N days" warning
        const soonRow = patSection.getTokenRow('expiring soon token');
        await expect(soonRow.getByText('Active')).toBeVisible();
        await expect(soonRow.getByText(/Expires in \d+ days?/)).toBeVisible();

        // * The disabled token shows the Disabled badge
        const disabledRow = patSection.getTokenRow('disabled token');
        await expect(disabledRow.getByText('Disabled')).toBeVisible();
    });
});
