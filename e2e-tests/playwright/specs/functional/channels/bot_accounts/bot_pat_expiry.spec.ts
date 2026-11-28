// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, test, duration, Msg, settle} from '@mattermost/playwright-lib';

test.describe('Bot account personal access token expiry @bot_accounts @personal_access_tokens', () => {
    test('creates and regenerates a user-owned bot token under an enforced maximum lifetime', async ({pw}) => {
        test.setTimeout(duration.two_min);
        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();

        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBotAccountCreation: true,
                EnableUserAccessTokens: true,
                MaximumPersonalAccessTokenLifetimeDays: 30,
            },
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (
                cfg.ServiceSettings?.EnableBotAccountCreation === true &&
                cfg.ServiceSettings?.EnableUserAccessTokens === true &&
                cfg.ServiceSettings?.MaximumPersonalAccessTokenLifetimeDays === 30
            );
        });

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Create a user-owned bot account. Add Bot always creates a default token.
        const username = `patbot${Date.now().toString(36).slice(-8)}`;
        await app.page.goto(`${app.integrationsPage.pathFor({team})}/bots/add`);
        const form = app.integrations.botForm;
        await form.usernameTextbox.fill(username);

        await expect(form.defaultTokenTitleText).toHaveMessage(Msg.bot.add.default_token.title);

        // * The default-token expiry picker is enforced and clamped by the 30-day policy.
        const expiry = form.defaultToken.expiryCombobox;
        await expect(expiry).toBeVisible();
        await expect(expiry).not.toContainMessage(Msg.user.settings.tokens.expiry.none);
        await expect(expiry).toContainText('30 days');
        await expect(expiry).not.toContainMessage(Msg.user.settings.tokens.expiry['90d']);
        await expect(form.defaultToken.expiryEnforcedText).toHaveMessage(Msg.user.settings.tokens.expiryEnforced);
        await expect(form.defaultToken.expiryEnforcedText).toBeVisible();

        await settle(form.saveButton, {wait: Api.CreateUserAccessToken}).click();
        await expect(app.page).toHavePath(`${app.integrationsPage.pathFor({team})}/confirm`);
        await expect(app.integrations.confirm.copyTokenButton).toBeVisible();
        await expect(app.integrations.confirm.tokenText).toHaveText(/^Token:/);

        // # Return to the bot list and regenerate the default token.
        await app.page.goto(`${app.integrationsPage.pathFor({team})}/bots`);
        const botUser = await adminClient.getUserByUsername(username);
        const bot = app.integrations.bots.bot({user_id: botUser.id});
        await expect(bot).toBeVisible();

        // * The default token is the bot's only token, active, with an expiry date rather than "Never"
        await expect(bot.tokenList).toHaveKeyCount(1);
        const token = bot.token({id: (await bot.tokenList.keys())[0]});
        await expect(token).toContainMessage(Msg.bot.token.default.description);
        await expect(token).toBeVisible();
        await expect(token.statusText).toHaveMessage(Msg.user.settings.tokens.status.active);
        await expect(token.statusText).toBeVisible();
        await expect(token.expiryText).toContainMessage(Msg.user.settings.tokens.expiry._);
        await expect(token.expiryText).toBeVisible();
        await expect(token.expiryText).not.toContainMessage(Msg.user.settings.tokens.expiry.never);

        await token.regenerateLink.click();
        const regenerate = app.botTokenRegenerateModal;
        await expect(regenerate).toContainMessage(Msg.user.settings.tokens.confirmRegenerateTitle);
        await expect(regenerate).toBeVisible();
        await expect(regenerate.expiryCombobox).toBeVisible();
        await expect(regenerate.expiryCombobox).not.toContainMessage(Msg.user.settings.tokens.expiry.none);
        await expect(regenerate.confirmButton).toHaveMessage(Msg.user.settings.tokens.confirmRegenerateButton);
        await expect(regenerate.confirmButton).toBeVisible();
        await settle(regenerate.confirmButton, {wait: Api.RotateUserAccessToken}).click();

        // * The rotated secret is revealed using the same one-time-copy pattern.
        await expect(bot.newToken).toContainMessage(Msg.user.settings.tokens.token);
        await expect(bot.newToken).toBeVisible();
        await expect(bot.newToken.copyButton).toBeVisible();
    });
});
