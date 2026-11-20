// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test, testConfig, Api, settle} from '@mattermost/playwright-lib';

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
        const {adminClient, team, user, townSquare: channel} = await pw.initSetup();
        const actions = [
            {id: 'primary', name: 'Primary action', type: 'button', style: 'primary'},
            {id: 'danger', name: 'Danger action', type: 'button', style: 'danger'},
            {id: 'default', name: 'Default action', type: 'button'},
        ];
        const webhook = await adminClient.createIncomingWebhook({
            channel_id: channel.id,
            display_name: 'Theme buttons',
        });
        await postToWebhook(webhook.id, {
            attachments: [
                {
                    text: 'Theme button test',
                    actions,
                },
            ],
        });

        const {order} = await adminClient.getPosts(channel.id, 0, 1);

        // # Open the channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        const post = app.center.postList.post({id: order[0]});

        for (const theme of ['indigo', 'onyx', 'denim'] as const) {
            // # Switch to the premade theme in Settings > Display > Theme
            await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
            await app.userSettingsModal.tabs.tab('display').select();
            await expect(app.userSettingsModal.tabs.tab('display')).toBeSelected();
            const section = app.settings.display.section('theme');
            await section.editButton.clickTo(section.premadeTheme(theme));
            await section.premadeTheme(theme).click();
            await expect(section.premadeTheme(theme)).toHaveClass(/active/);
            await settle(section.saveButton, {wait: Api.UpdatePreferences}).click();
            await app.userSettingsModal.closeButton.click();
            await expect(app.userSettingsModal).not.toBeVisible();

            // * Verify every attachment button is still shown with its label
            for (const action of actions) {
                // Attachment buttons render through the block renderer, keyed by their action id.
                await expect(post.blockAction(action.id)).toBeVisible();
                await expect(post.blockAction(action.id)).toHaveText(action.name);
            }
        }
    },
);
