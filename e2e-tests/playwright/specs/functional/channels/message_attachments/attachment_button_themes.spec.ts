// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {postToWebhook} from '../webhook_helpers';

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
            await expect(post.getButton('Primary action')).toBeVisible();
            await expect(post.getButton('Danger action')).toBeVisible();
            await expect(post.getButton('Default action')).toBeVisible();
        }
    },
);
