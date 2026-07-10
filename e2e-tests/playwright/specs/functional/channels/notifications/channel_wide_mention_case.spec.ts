// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// The notify-all confirmation modal appears once a channel has more than this many members.
const NOTIFY_ALL_THRESHOLD = 5;

const NOTIFY_ALL_TITLE = 'Confirm sending notifications to entire channel';

/**
 * @objective Verify a channel-wide mention typed in mixed case (@channEL) is recognized as a mention,
 * prompts the notify-all confirmation, and is posted with its original casing preserved.
 */
test(
    'MM-T484 recognizes a mixed-case @channEL channel-wide mention and preserves its casing',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Add enough members so the channel exceeds the notify-all threshold
        for (let i = 0; i < NOTIFY_ALL_THRESHOLD; i++) {
            const extraUser = await pw.createNewUserProfile(adminClient, {prefix: 'channel-wide'});
            await adminClient.addToTeam(team.id, extraUser.id);
        }

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Type a mixed-case channel-wide mention and send it
        const message = `@channEL mixed case mention ${pw.random.id()}`;
        await channelsPage.centerView.postCreate.writeMessage(message);
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify the notify-all confirmation modal appears (mention was recognized despite casing)
        const confirmModal = channelsPage.getConfirmModal(NOTIFY_ALL_TITLE);
        await confirmModal.toBeVisible();

        // # Confirm sending the notification
        await confirmModal.confirm();

        // * Verify the posted message preserves the mixed-case mention
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText(message);
    },
);

/**
 * @objective Verify an @HERE channel-wide mention typed in uppercase is recognized as a mention,
 * prompts the notify-all confirmation, and keeps its uppercase casing after switching channels.
 */
test(
    'MM-T485 recognizes an uppercase @HERE channel-wide mention and preserves its casing',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Add enough members so the channel exceeds the notify-all threshold
        for (let i = 0; i < NOTIFY_ALL_THRESHOLD; i++) {
            const extraUser = await pw.createNewUserProfile(adminClient, {prefix: 'channel-wide'});
            await adminClient.addToTeam(team.id, extraUser.id);
        }

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        // * Verify the "Channel-wide mentions" keyword is enabled by default in notification settings
        const settingsModal = await channelsPage.openSettings();
        const notificationSettings = await settingsModal.openNotificationsTab();
        await notificationSettings.keywordsTriggerNotificationsEditButton.click();
        await expect(notificationSettings.channelWideMentionsCheckbox).toBeChecked();
        await settingsModal.close();

        // # Type an uppercase channel-wide mention and send it
        const message = `@HERE channel-wide mention ${pw.random.id()}`;
        await channelsPage.centerView.postCreate.writeMessage(message);
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify the notify-all confirmation modal appears (mention was recognized despite uppercase)
        const confirmModal = channelsPage.getConfirmModal(NOTIFY_ALL_TITLE);
        await confirmModal.toBeVisible();

        // # Confirm sending the notification
        await confirmModal.confirm();

        // * Verify the posted message preserves the uppercase mention
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText(message);

        // # Switch to another channel and back
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.sidebarLeft.goToItem('off-topic');

        // * Verify the uppercase mention is still shown after returning to the channel
        const postAfterSwitch = await channelsPage.getLastPost();
        await postAfterSwitch.toContainText(message);
    },
);
