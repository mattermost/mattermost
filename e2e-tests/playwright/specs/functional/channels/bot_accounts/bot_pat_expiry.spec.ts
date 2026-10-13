// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

async function dismissWebpackOverlay(page: Page) {
    await page
        .locator('#webpack-dev-server-client-overlay')
        .evaluateAll((nodes) => {
            nodes.forEach((node) => node.remove());
        })
        .catch(() => null);
}

test.describe('Bot account personal access token expiry @bot_accounts @personal_access_tokens', () => {
    test('creates and regenerates a user-owned bot token under an enforced maximum lifetime', async ({pw}) => {
        test.setTimeout(120000);
        const {adminUser, adminClient, team} = await pw.initSetup();

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

        const {channelsPage, page} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Create a user-owned bot account. Add Bot always creates a default token.
        const username = `patbot${Date.now().toString(36).slice(-8)}`;
        await page.goto(`/${team.name}/integrations/bots/add`);
        await dismissWebpackOverlay(page);
        await page.locator('#username').fill(username);

        // * The default-token expiry picker is enforced and clamped by the 30-day policy.
        await expect(page.getByText('Default access token', {exact: true})).toBeVisible();
        const defaultTokenExpiry = page.locator('#defaultTokenExpiry');
        await expect(defaultTokenExpiry).toBeVisible();
        await expect(defaultTokenExpiry.locator('option', {hasText: 'No expiry'})).toHaveCount(0);
        await expect(defaultTokenExpiry.locator('option', {hasText: '30 days'})).toHaveCount(1);
        await expect(defaultTokenExpiry.locator('option', {hasText: '90 days'})).toHaveCount(0);
        await expect(
            page.getByText('Your administrator requires all personal access tokens to have an expiry date.'),
        ).toBeVisible();

        await page.locator('#saveBot').click();
        await page.waitForURL(/\/integrations\/confirm\?type=bots/);
        await expect(page.getByText('Token:')).toBeVisible();

        // # Return to the bot list and regenerate the default token.
        await page.goto(`/${team.name}/integrations/bots`);
        await dismissWebpackOverlay(page);
        await page.locator('#searchInput').fill(username);
        const botItem = page.locator('.backstage-list__item', {hasText: `@${username}`});
        await expect(botItem).toBeVisible();

        const defaultTokenRow = botItem.locator('.bot-list__item', {hasText: 'Default Token'});
        await expect(defaultTokenRow.getByText('Active')).toBeVisible();
        await expect(defaultTokenRow.getByText('Expires:')).toBeVisible();
        await expect(defaultTokenRow.getByText('Never')).toBeHidden();

        await defaultTokenRow.getByRole('link', {name: 'Regenerate'}).click();
        const confirmModal = page.locator('#confirmModal');
        await expect(confirmModal.getByText('Regenerate Token?')).toBeVisible();
        await expect(confirmModal.locator('#regenerateBotTokenExpiry')).toBeVisible();
        await expect(
            confirmModal.locator('#regenerateBotTokenExpiry').locator('option', {hasText: 'No expiry'}),
        ).toHaveCount(0);
        await confirmModal.getByRole('button', {name: 'Yes, Regenerate'}).click();

        // * The rotated secret is revealed using the same one-time-copy pattern.
        await expect(botItem.getByText('Access Token:')).toBeVisible();
        await expect(botItem.getByLabel('Copy Token')).toBeVisible();
    });
});
