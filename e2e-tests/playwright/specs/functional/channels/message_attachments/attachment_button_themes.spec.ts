// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test, testConfig} from '@mattermost/playwright-lib';

async function postToWebhook(webhookId: string, payload: Record<string, unknown>) {
    const response = await fetch(`${testConfig.baseURL}/hooks/${webhookId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(duration.ten_sec),
    });
    if (!response.ok) {
        throw new Error(`Webhook POST failed: ${response.status} ${await response.text()}`);
    }
}

/**
 * @objective Verify interactive attachment buttons remain visible across Indigo, Onyx, and Denim themes.
 */
test(
    'MM-T5672 displays attachment buttons correctly across premade themes',
    {tag: '@message_attachments'},
    async ({pw}) => {
        // # Post an attachment containing primary, danger, and default buttons
        const {adminClient, team, user} = await pw.initSetup();
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const webhook = await adminClient.createIncomingWebhook({
            channel_id: channel.id,
            display_name: 'Theme buttons',
        });
        await postToWebhook(webhook.id, {
            attachments: [
                {
                    text: 'Theme button test',
                    actions: [
                        {id: 'primary', name: 'Primary action', type: 'button', style: 'primary'},
                        {id: 'danger', name: 'Danger action', type: 'button', style: 'danger'},
                        {id: 'default', name: 'Default action', type: 'button'},
                    ],
                },
            ],
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        const post = await channelsPage.getLastPost();

        for (const theme of ['Indigo', 'Onyx', 'Denim'] as const) {
            // # Select and save the premade theme
            const settingsModal = await channelsPage.openSettings();
            const displaySettings = await settingsModal.openDisplayTab();
            await displaySettings.selectPremadeTheme(theme);
            await settingsModal.close();

            // * Verify all attachment buttons remain visible
            await expect(post.container.getByRole('button', {name: 'Primary action'})).toBeVisible();
            await expect(post.container.getByRole('button', {name: 'Danger action'})).toBeVisible();
            await expect(post.container.getByRole('button', {name: 'Default action'})).toBeVisible();
        }
    },
);
