// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IncomingWebhook} from '@mattermost/types/integrations';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an incoming webhook is listed with its URL and a copy button, and that deleting it
 * from the list (after confirming) removes it.
 */
test('lists an incoming webhook with its URL and deletes it after confirming', {tag: '@integrations'}, async ({pw}) => {
    const {adminClient, adminUser, team} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('the setup has no admin user');
    }
    await adminClient.patchConfig({ServiceSettings: {EnableIncomingWebhooks: true}} as any);
    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const hook = await adminClient.createIncomingWebhook({
        channel_id: channel.id,
        display_name: `Hook ${pw.random.id()}`,
    });

    // # Log in as the admin, open Integrations, then Incoming Webhooks
    const {app} = await pw.testBrowser.login(adminUser);
    await app.integrationsPage.goto({team});
    await app.integrations.options.incomingWebhooksLink.click();

    // * The webhook is listed by name, with its URL and a copy button
    const row = app.integrations.incomingWebhooks.hook(hook);
    await expect(row.name).toHaveText(hook.display_name);
    await expect(row.url).toContainText(`/hooks/${hook.id}`);
    await expect(row.url.copyButton).toBeVisible();

    // # Delete it and confirm
    const confirm = await row.deleteButton.clickTo(app.deleteIntegrationModal);
    await settle(confirm.confirmButton, {wait: Api.DeleteIncomingWebhook}).click();

    // * The row is gone, and so is the webhook
    await expect(row).toHaveCount(0);
    await expect
        .poll(async () => ((await adminClient.getIncomingWebhooks(team.id)) as IncomingWebhook[]).map((h) => h.id))
        .not.toContain(hook.id);
});
