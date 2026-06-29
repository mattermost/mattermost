// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type ChannelsPage, type PersonalAccessTokensSection, en, expect, test} from '@mattermost/playwright-lib';

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

// Open Account Settings > Security and expand the Personal Access Tokens section.
async function openTokensSection(channelsPage: ChannelsPage): Promise<PersonalAccessTokensSection> {
    await channelsPage.userAccountMenuButton.click();
    await channelsPage.userAccountMenu.profile.click();

    const profileModal = channelsPage.profileModal;
    await profileModal.toBeVisible();

    const securityTab = await profileModal.openSecurityTab();
    const pat = securityTab.personalAccessTokensSection;
    await pat.tokensEditButton.click();

    return pat;
}

test.describe('Personal Access Tokens expiry @personal_access_tokens', () => {
    test('shows the expiry picker with all presets and reveals the custom date input', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient, team} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableUserAccessTokens === true;
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open the Personal Access Tokens section and start creating a token
        const pat = await openTokensSection(channelsPage);
        await pat.createTokenButton.click();

        // * The expiry select offers "No expiry", every preset, and a custom option
        await expect(pat.expirySelect).toBeVisible();
        await expect(pat.getExpiryOption('No expiry')).toHaveCount(1);
        await expect(pat.getExpiryOption('7 days')).toHaveCount(1);
        await expect(pat.getExpiryOption('30 days')).toHaveCount(1);
        await expect(pat.getExpiryOption('90 days')).toHaveCount(1);
        await expect(pat.getExpiryOption('1 year')).toHaveCount(1);
        await expect(pat.getExpiryOption(/Custom date/)).toHaveCount(1);

        // * The custom date input is hidden until the custom option is chosen
        await expect(pat.expiryInput).toBeHidden();
        await pat.expirySelect.selectOption('custom');
        await expect(pat.expiryInput).toBeVisible();
    });

    test('blocks submitting a custom expiry with no date chosen', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient, team} = await pw.initSetup();
        await adminClient.patchConfig({ServiceSettings: {EnableUserAccessTokens: true}});
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings?.EnableUserAccessTokens === true;
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const pat = await openTokensSection(channelsPage);
        await pat.createTokenButton.click();

        // # Provide a description, pick the custom preset, then clear the date
        await pat.tokenNameInput.fill('My token');
        await pat.expirySelect.selectOption('custom');
        await pat.expiryInput.fill('');

        // * The inline validation error surfaces and Save is disabled, so no token can be created
        await expect(pat.validationMessage(en['user.settings.tokens.expiryRequired'])).toBeVisible();
        await expect(pat.saveButton).toBeDisabled();
        await expect(pat.accessTokenValue).toBeHidden();
    });

    test('enforces expiry when a maximum lifetime is configured', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient, team} = await pw.initSetup();
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
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const pat = await openTokensSection(channelsPage);
        await pat.createTokenButton.click();

        // * "No expiry" and presets longer than the maximum are hidden; the enforced hint shows
        await expect(pat.getExpiryOption('No expiry')).toHaveCount(0);
        await expect(pat.getExpiryOption('90 days')).toHaveCount(0);
        await expect(pat.getExpiryOption('1 year')).toHaveCount(0);
        await expect(pat.getExpiryOption('7 days')).toHaveCount(1);
        await expect(pat.getExpiryOption('30 days')).toHaveCount(1);
        await expect(pat.expiryEnforcedHint).toBeVisible();

        // # Choose a custom date beyond the configured maximum
        await pat.tokenNameInput.fill('My token');
        await pat.expirySelect.selectOption('custom');
        await pat.expiryInput.fill(isoPlusDays(60));

        // * The over-the-limit error surfaces inline and Save is disabled
        await expect(pat.validationMessage(/Expiry can be at most/i)).toBeVisible();
        await expect(pat.saveButton).toBeDisabled();
    });

    test('creates a token with the default preset under a maximum lifetime', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient, team} = await pw.initSetup();
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
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const pat = await openTokensSection(channelsPage);
        await pat.createTokenButton.click();

        // # Accept the default preset (which equals the cap) and save
        await pat.tokenNameInput.fill('My token');
        await pat.saveButton.click();

        // * The token is created (the server accepts the clamped expiry) and revealed
        await expect(pat.accessTokenValue).toBeVisible();
        await expect(pat.validationMessage(/Expiry can be at most/i)).toBeHidden();
    });

    test('shows status and expiry for existing tokens', async ({pw}) => {
        test.setTimeout(120000);
        const {user, adminClient, team} = await pw.initSetup();
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
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const pat = await openTokensSection(channelsPage);

        // * The never-expiring token is Active and shows "Never"
        const neverRow = pat.getTokenRowByName('never expires token');
        await expect(neverRow.getByText('Active')).toBeVisible();
        await expect(neverRow.getByText(/Never/)).toBeVisible();

        // * The soon-expiring token is Active and shows an "expires in N days" warning
        const soonRow = pat.getTokenRowByName('expiring soon token');
        await expect(soonRow.getByText('Active')).toBeVisible();
        await expect(soonRow.getByText(/Expires in \d+ days?/)).toBeVisible();

        // * The disabled token shows the Disabled badge
        const disabledRow = pat.getTokenRowByName('disabled token');
        await expect(disabledRow.getByText('Disabled')).toBeVisible();
    });
});
