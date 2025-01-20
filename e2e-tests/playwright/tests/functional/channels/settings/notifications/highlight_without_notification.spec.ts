// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {getRandomId} from '@e2e-support/util';
import {createRandomPost} from '@e2e-support/server/post';

const keywords = [`AB${getRandomId()}`, `CD${getRandomId()}`, `EF${getRandomId()}`, `Highlight me ${getRandomId()}`];

const highlightWithoutNotificationClass = 'non-notification-highlight';

test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.centerView.postCreate.postMessage('Hello World');

    // # Open settings modal
    await channelsPage.globalHeader.openSettings();
    await channelsPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelsPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelsPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    const keywordsInput = await channelsPage.settingsModal.notificationsSettings.getKeywordsInput();

    // # Enter keyword 1
    await keywordsInput.fill(keywords[0]);

    // # Press Comma on the textbox
    await keywordsInput.press(',');

    // # Enter keyword 2
    await keywordsInput.fill(keywords[1]);

    // # Press Tab on the textbox
    await keywordsInput.press('Tab');

    // # Enter keyword 3
    await keywordsInput.fill(keywords[2]);

    // # Press Enter on the textbox
    await keywordsInput.press('Enter');

    // * Verify that the keywords have been added to the collapsed description
    const keysWithHighlightDesc = channelsPage.settingsModal.notificationsSettings.keysWithHighlightDesc;
    await keysWithHighlightDesc.waitFor();
    for (const keyword of keywords.slice(0, 3)) {
        expect(await keysWithHighlightDesc).toContainText(keyword);
    }
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
    await channelsPage.globalHeader.openSettings();
    await channelsPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelsPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelsPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelsPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelsPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelsPage.settingsModal.closeModal();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelsPage.centerView.postCreate.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelsPage.centerView.getLastPost();

    // * Verify that the keywords are not highlighted
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).toBeVisible();
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).not.toHaveClass(
        highlightWithoutNotificationClass,
    );

    // # Post a message with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelsPage.centerView.postCreate.postMessage(messageWithKeyword);
    const lastPostWithHighlight = await channelsPage.centerView.getLastPost();

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
    await channelsPage.globalHeader.openSettings();
    await channelsPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelsPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelsPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelsPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelsPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelsPage.settingsModal.closeModal();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelsPage.centerView.postCreate.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelsPage.centerView.getLastPost();

    // # Open the message in the RHS
    await lastPostWithoutHighlight.hover();
    await lastPostWithoutHighlight.postMenu.toBeVisible();
    await lastPostWithoutHighlight.postMenu.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // # Post a message with the keyword in the RHS
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelsPage.sidebarRight.postCreate.postMessage(messageWithKeyword);

    // * Verify that the keywords are highlighted
    const lastPostWithHighlightInRHS = await channelsPage.sidebarRight.getLastPost();
    await expect(lastPostWithHighlightInRHS.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlightInRHS.container.getByText(keywords[3])).toHaveClass(
        highlightWithoutNotificationClass,
    );
});

test('MM-T5465-4 Highlighted keywords should not appear in the Recent Mentions', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    await channelsPage.globalHeader.openSettings();
    await channelsPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelsPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelsPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelsPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelsPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelsPage.settingsModal.closeModal();

    // # Open the recent mentions
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify recent mentions is empty
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.sidebarRight.container.getByText('No mentions yet')).toBeVisible();
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
        createRandomPost({
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
    await channelsPage.globalHeader.openSettings();
    await channelsPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelsPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelsPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelsPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelsPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelsPage.settingsModal.closeModal();

    // * Verify that the keywords are highlighted in the last message received
    const lastPostWithHighlight = await channelsPage.centerView.getLastPost();
    await expect(lastPostWithHighlight.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.getByText(highlightKeyword)).toHaveClass(
        highlightWithoutNotificationClass,
    );
});
