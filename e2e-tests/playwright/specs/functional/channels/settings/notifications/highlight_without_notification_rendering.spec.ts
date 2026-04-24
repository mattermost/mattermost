// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {generateKeywords, highlightWithoutNotificationClass} from './support';

let keywords: string[];

test.beforeEach(async ({pw}) => {
    keywords = generateKeywords(pw);
});

test('MM-T5465-2 Should highlight the keywords when a message is sent with the keyword in center', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelsPage.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelsPage.getLastPost();

    // * Verify that the keywords are not highlighted
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).toBeVisible();
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).not.toHaveClass(
        highlightWithoutNotificationClass,
    );

    // # Post a message with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelsPage.postMessage(messageWithKeyword);
    const lastPostWithHighlight = await channelsPage.getLastPost();

    // * Verify that the keywords are highlighted
    await expect(lastPostWithHighlight.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.getByText(keywords[3])).toHaveClass(highlightWithoutNotificationClass);
});

test('MM-T5465-3 Should highlight the keywords when a message is sent with the keyword in rhs', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelsPage.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelsPage.getLastPost();

    // # Open the message in the RHS
    await lastPostWithoutHighlight.hover();
    await lastPostWithoutHighlight.postMenu.toBeVisible();
    await lastPostWithoutHighlight.postMenu.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // # Post a message with the keyword in the RHS
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelsPage.sidebarRight.postMessage(messageWithKeyword);

    // * Verify that the keywords are highlighted
    const lastPostWithHighlightInRHS = await channelsPage.sidebarRight.getLastPost();
    await expect(lastPostWithHighlightInRHS.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlightInRHS.container.getByText(keywords[3])).toHaveClass(
        highlightWithoutNotificationClass,
    );
});

test('MM-T5465-5 Should highlight keywords in message sent from another user', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {adminClient, team, adminUser, user} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Get the default channel of the team for getting the channel id
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const highlightKeyword = keywords[0];
    const messageWithKeyword = `This received message contains the ${highlightKeyword} keyword `;

    // # Create a post containing the keyword in the channel by admin
    await adminClient.createPost(
        pw.random.post({
            message: messageWithKeyword,
            channel_id: channel.id,
            user_id: adminUser.id,
        }),
    );

    // # Now log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // * Verify that the keywords are highlighted in the last message received
    const lastPostWithHighlight = await channelsPage.getLastPost();
    await expect(lastPostWithHighlight.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.getByText(highlightKeyword)).toHaveClass(
        highlightWithoutNotificationClass,
    );
});
