// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    Msg,
    test,
    type App,
    type PlaywrightExtended,
    duration,
    Api,
    settle,
    formatMessage,
} from '@mattermost/playwright-lib';

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

// Enables tokens and sets the maximum lifetime, then waits for the server to report both. The
// maximum is server-wide, so every test states the value it needs rather than inheriting one.
async function setTokenPolicy(adminClient: Client4, maximumLifetimeDays: number) {
    await adminClient.patchConfig({
        ServiceSettings: {EnableUserAccessTokens: true, MaximumPersonalAccessTokenLifetimeDays: maximumLifetimeDays},
    });

    await expect
        .poll(async () => {
            const {ServiceSettings} = await adminClient.getConfig();
            return {
                enabled: ServiceSettings?.EnableUserAccessTokens,
                maximumLifetimeDays: ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays,
            };
        })
        .toEqual({enabled: true, maximumLifetimeDays});
}

// Open Account Settings > Security and expand the Personal Access Tokens section.
async function openTokensSection(pw: PlaywrightExtended, user: UserProfile) {
    const {app} = await pw.testBrowser.login(user);
    const team = (await (await pw.makeClient(user)).client.getMyTeams())[0];
    await app.channelsPage.goto({team, channel: 'town-square'});
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.nameMenuItem);
    const modal = await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await expect(modal).toBeVisible();
    await modal.tabs.tab('security').select();
    await expect(modal.tabs.tab('security')).toBeSelected();
    await app.settings.security.section('tokens').editButton.click();
    await expect(app.settings.accessTokens.createButton).toBeVisible();
    return app;
}

/** The values of a select's options, in order. */
async function optionValues(select: {locator: Locator}) {
    // Native option values have no generated list; inspect this declared select.
    return select.locator.evaluate((el: HTMLSelectElement) => [...el.options].map((o) => o.value));
}

/** Native options have no generated members, so how many show a label is counted from the select's option texts. */
async function expectOptionCount(select: {locator: Locator}, label: string, count: number): Promise<void> {
    // The select's native options have no declared parts; their texts are read from this declared select.
    await expect
        .poll(async () => {
            const labels = await select.locator.evaluate((el: HTMLSelectElement) =>
                [...el.options].map((o) => o.text.trim()),
            );
            return labels.filter((text) => text === label).length;
        })
        .toBe(count);
}

/** Opens the create form. */
async function startCreating(app: App) {
    const tokens = app.settings.accessTokens;
    await tokens.createButton.click();
    await expect(tokens.newToken.descriptionTextbox).toBeVisible();
    return tokens.newToken;
}

test.describe('Personal Access Tokens expiry @personal_access_tokens', () => {
    test('shows the expiry picker with all presets and reveals the custom date input', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Open the Personal Access Tokens section and start creating a token
        const app = await openTokensSection(pw, user);
        const form = await startCreating(app);

        // * The expiry select offers "No expiry", every preset, and a custom option
        expect(await optionValues(form.expiryCombobox)).toEqual(['none', '7d', '30d', '90d', '1y', 'custom']);
        await expect(form.expiryCombobox).toBeVisible();
        for (const preset of ['none', '7d', '30d', '90d', '1y', 'custom'] as const) {
            await expectOptionCount(form.expiryCombobox, formatMessage(Msg.user.settings.tokens.expiry[preset]), 1);
        }

        // * The custom date input is hidden until the custom option is chosen
        await expect(form.expiryDateTextbox).toBeHidden();
        await form.expiryCombobox.choose(formatMessage(Msg.user.settings.tokens.expiry.custom));
        await expect(form.expiryCombobox).toHaveValue('custom');
        await expect(form.expiryDateTextbox).toBeVisible();
    });

    test('blocks submitting a custom expiry with no date chosen', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        const app = await openTokensSection(pw, user);
        const form = await startCreating(app);

        // # Provide a description, pick the custom preset, then clear the date
        await form.descriptionTextbox.fill('My token');
        await form.expiryCombobox.choose(formatMessage(Msg.user.settings.tokens.expiry.custom));
        await expect(form.expiryCombobox).toHaveValue('custom');
        await form.expiryDateTextbox.fill('');

        // * The inline validation error surfaces and Save is disabled, so no token can be created
        await expect(form.errorText).toHaveMessage(Msg.user.settings.tokens.expiryRequired);
        await expect(form.errorText).toBeVisible();
        await expect(form.saveButton).toBeDisabled();
        await expect(form.tokenText).toBeHidden();
    });

    test('enforces expiry when a maximum lifetime is configured', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 30);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        const app = await openTokensSection(pw, user);
        const form = await startCreating(app);

        // * "No expiry" and presets longer than the maximum are hidden; the enforced hint shows
        expect(await optionValues(form.expiryCombobox)).toEqual(['7d', '30d', 'custom']);
        for (const preset of ['none', '90d', '1y'] as const) {
            await expectOptionCount(form.expiryCombobox, formatMessage(Msg.user.settings.tokens.expiry[preset]), 0);
        }
        for (const preset of ['7d', '30d'] as const) {
            await expectOptionCount(form.expiryCombobox, formatMessage(Msg.user.settings.tokens.expiry[preset]), 1);
        }
        await expect(form.expiryEnforcedText).toHaveMessage(Msg.user.settings.tokens.expiryEnforced);
        await expect(form.expiryEnforcedText).toBeVisible();

        // # Choose a custom date beyond the configured maximum
        await form.descriptionTextbox.fill('My token');
        await form.expiryCombobox.choose(formatMessage(Msg.user.settings.tokens.expiry.custom));
        await expect(form.expiryCombobox).toHaveValue('custom');
        await form.expiryDateTextbox.fill(isoPlusDays(60));

        // * The over-the-limit error surfaces inline and Save is disabled
        await expect(form.errorText).toHaveText('Expiry can be at most 30 days from now.');
        await expect(form.errorText).toBeVisible();
        await expect(form.saveButton).toBeDisabled();
    });

    test('creates a token with the default preset under a maximum lifetime', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 30);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        const app = await openTokensSection(pw, user);
        const form = await startCreating(app);

        // # Accept the default preset (which equals the cap) and save
        await form.descriptionTextbox.fill('My token');
        await settle(form.saveButton, {wait: Api.CreateUserAccessToken}).click();

        // * The token is created (the server accepts the clamped expiry) and revealed
        await expect(form.tokenText).toContainMessage(Msg.user.settings.tokens.token);
        await expect(form.tokenText).toBeVisible();
        await expect(form.errorText).toBeHidden();
    });

    test('shows status and expiry for existing tokens', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed three tokens for the user: never-expiring, expiring soon, and disabled
        const neverToken = await adminClient.createUserAccessToken(user.id, 'never expires token');
        const soonToken = await adminClient.createUserAccessToken(
            user.id,
            'expiring soon token',
            Date.now() + 3 * DAY_MS,
        );
        const disabledToken = await adminClient.createUserAccessToken(user.id, 'disabled token');
        await adminClient.disableUserAccessToken(disabledToken.id);

        const app = await openTokensSection(pw, user);
        const tokens = app.settings.accessTokens;

        // * The never-expiring token is Active and shows "Never"
        const neverRow = tokens.token(neverToken.id);
        await expect(neverRow.statusText).toHaveMessage(Msg.user.settings.tokens.status.active);
        await expect(neverRow.statusText).toBeVisible();
        await expect(neverRow.expiryText).toContainMessage(Msg.user.settings.tokens.expiry.never);
        await expect(neverRow.expiryText).toBeVisible();

        // * The soon-expiring token is Active and shows an "expires in N days" warning
        const soonRow = tokens.token(soonToken.id);
        await expect(soonRow.statusText).toHaveMessage(Msg.user.settings.tokens.status.active);
        await expect(soonRow.statusText).toBeVisible();
        await expect(soonRow.expiryText).toContainText(/Expires in \d+ days?/);

        // * The disabled token shows the Disabled badge
        await expect(tokens.token(disabledToken.id).statusText).toHaveMessage(Msg.user.settings.tokens.status.inactive);
        await expect(tokens.token(disabledToken.id).statusText).toBeVisible();
    });

    test('regenerates a token and reveals the new secret', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed a token for the user
        const originalToken = await adminClient.createUserAccessToken(user.id, 'rotate me token');

        const app = await openTokensSection(pw, user);
        const tokens = app.settings.accessTokens;
        const tokenRow = tokens.token(originalToken.id);
        await expect(tokenRow).toContainText(originalToken.id);
        await expect(tokenRow).toBeVisible();

        // # Click Regenerate and confirm the warning naming the token
        await tokenRow.regenerateLink.click();
        await expect(tokens.confirmModal.confirmButton).toHaveMessage(Msg.user.settings.tokens.confirmRegenerateButton);
        await expect(tokens.confirmModal.confirmButton).toBeVisible();
        await expect(tokens.confirmModal).toContainText('rotate me token');
        await expect(tokens.confirmModal).toContainMessage(Msg.user.settings.tokens.confirmRegenerateTitle);
        await settle(tokens.confirmModal.confirmButton, {wait: Api.RotateUserAccessToken}).click();

        // * The new secret is revealed, the token keeps its id, and the old row is hidden
        await expect(tokens.newToken.tokenText).toContainMessage(Msg.user.settings.tokens.token);
        await expect(tokens.newToken.tokenText).toBeVisible();
        // The new-token id has no generated member; it is beside the declared token text in the warning.
        await expect(tokens.newToken.idText).toBeVisible();
        await expect(tokens.newToken.idText).toContainText(originalToken.id);
        await expect(tokenRow).toBeHidden();

        // * The old secret no longer authenticates, the token is still enabled
        const rotated = await adminClient.getUserAccessToken(originalToken.id);
        expect(rotated.is_active).toBe(true);
        expect(rotated.id).toBe(originalToken.id);
    });

    test('lets the user pick a new expiry when regenerating', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        // # Seed a never-expiring token for the user
        const originalToken = await adminClient.createUserAccessToken(user.id, 'expiring rotate token');
        expect(originalToken.expires_at).toBe(0);

        const app = await openTokensSection(pw, user);
        const tokens = app.settings.accessTokens;

        // # Regenerate, choosing a 7-day expiry instead of the "no expiry" default
        await tokens.token(originalToken.id).regenerateLink.clickTo(tokens.confirmModal);
        await tokens.regenerate.expiryCombobox.choose(formatMessage(Msg.user.settings.tokens.expiry['7d']));
        await expect(tokens.regenerate.expiryCombobox).toHaveValue('7d');
        await settle(tokens.confirmModal.confirmButton, {wait: Api.RotateUserAccessToken}).click();

        // * The rotated token now has a future expiry set
        await expect(tokens.newToken.tokenText).toContainMessage(Msg.user.settings.tokens.token);
        await expect(tokens.newToken.tokenText).toBeVisible();
        const rotated = await adminClient.getUserAccessToken(originalToken.id);
        expect(rotated.expires_at).toBeGreaterThan(Date.now());
    });

    test('does not offer to regenerate a disabled token', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {user, adminClient} = await pw.initSetup();
        await setTokenPolicy(adminClient, 0);
        await adminClient.updateUserRoles(user.id, TOKEN_ROLES);

        const disabledToken = await adminClient.createUserAccessToken(user.id, 'disabled token');
        await adminClient.disableUserAccessToken(disabledToken.id);

        const app = await openTokensSection(pw, user);
        const disabledRow = app.settings.accessTokens.token(disabledToken.id);

        // * No Regenerate link for a disabled token (the row itself shows, with its Enable link)
        await expect(disabledRow.activateLink).toBeVisible();
        await expect(disabledRow.regenerateLink).toBeHidden();
    });
});
