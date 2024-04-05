// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {getRandomId} from '@e2e-support/util';
import {createRandomPost} from '@e2e-support/server/post';

const keywords = [`AB${getRandomId()}`, `CD${getRandomId()}`, `EF${getRandomId()}`, `Highlight me ${getRandomId()}`];

const highlightWithoutNotificationClass = 'non-notification-highlight';

test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw, pages}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.postMessage('Hello World');

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    const keywordsInput = await channelPage.settingsModal.notificationsSettings.getKeywordsInput();

    // # Enter keyword 1
    await keywordsInput.type(keywords[0]);

    // # Press Comma on the textbox
    await keywordsInput.press(',');

    // # Enter keyword 2
    await keywordsInput.type(keywords[1]);

    // # Press Tab on the textbox
    await keywordsInput.press('Tab');

    // # Enter keyword 3
    await keywordsInput.type(keywords[2]);

    // # Press Enter on the textbox
    await keywordsInput.press('Enter');

    // * Verify that the keywords have been added to the collapsed description
    const keysWithHighlightDesc = channelPage.settingsModal.notificationsSettings.keysWithHighlightDesc;
    await keysWithHighlightDesc.waitFor();
    for (const keyword of keywords.slice(0, 3)) {
        expect(await keysWithHighlightDesc).toContainText(keyword);
    }
});

test('MM-T5465-2 Should highlight the keywords when a message is sent with the keyword in center', async ({
    pw,
    pages,
}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.type(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelPage.settingsModal.closeModal();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelPage.centerView.postCreate.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelPage.centerView.getLastPost();

    // * Verify that the keywords are not highlighted
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).toBeVisible();
    await expect(lastPostWithoutHighlight.container.getByText(messageWithoutKeyword)).not.toHaveClass(
        highlightWithoutNotificationClass,
    );

    // # Post a message with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelPage.centerView.postCreate.postMessage(messageWithKeyword);
    const lastPostWithHighlight = await channelPage.centerView.getLastPost();

    // * Verify that the keywords are highlighted
    await expect(lastPostWithHighlight.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.getByText(keywords[3])).toHaveClass(highlightWithoutNotificationClass);
});

test('MM-T5465-3 Should highlight the keywords when a message is sent with the keyword in rhs', async ({pw, pages}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.type(keywords[3]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelPage.settingsModal.closeModal();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await channelPage.centerView.postCreate.postMessage(messageWithoutKeyword);
    const lastPostWithoutHighlight = await channelPage.centerView.getLastPost();

    // # Open the message in the RHS
    await lastPostWithoutHighlight.hover();
    await lastPostWithoutHighlight.postMenu.toBeVisible();
    await lastPostWithoutHighlight.postMenu.reply();
    await channelPage.sidebarRight.toBeVisible();

    // # Post a message with the keyword in the RHS
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await channelPage.sidebarRight.postCreate.postMessage(messageWithKeyword);

    // * Verify that the keywords are highlighted
    const lastPostWithHighlightInRHS = await channelPage.sidebarRight.getLastPost();
    await expect(lastPostWithHighlightInRHS.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlightInRHS.container.getByText(keywords[3])).toHaveClass(
        highlightWithoutNotificationClass,
    );
});

test('MM-T5465-4 Highlighted keywords should not appear in the Recent Mentions', async ({pw, pages}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.type(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelPage.settingsModal.closeModal();

    // # Open the recent mentions
    await channelPage.globalHeader.openRecentMentions();

    // * Verify recent mentions is empty
    await channelPage.sidebarRight.toBeVisible();
    await expect(channelPage.sidebarRight.container.getByText('No mentions yet')).toBeVisible();
});

test('MM-T5465-5 Should highlight keywords in message sent from another user', async ({pw, pages}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {adminClient, team, adminUser, user} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Get the default channel of the team for getting the channel id
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const highlightKeyword = keywords[0];
    const messageWithKeyword = `This recieved message contains the ${highlightKeyword} keyword `;

    // # Create a post containing the keyword in the channel by admin
    await adminClient.createPost(
        createRandomPost({
            message: messageWithKeyword,
            channel_id: channel.id,
            user_id: adminUser.id,
        }),
    );

    // # Now log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.settingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.settingsModal.notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await channelPage.settingsModal.notificationsSettings.getKeywordsInput();
    await keywordsInput.type(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await channelPage.settingsModal.notificationsSettings.save();

    // # Close the settings modal
    await channelPage.settingsModal.closeModal();

    // * Verify that the keywords are highlighted in the last message recieved
    const lastPostWithHighlight = await channelPage.centerView.getLastPost();
    await expect(lastPostWithHighlight.container.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.getByText(highlightKeyword)).toHaveClass(
        highlightWithoutNotificationClass,
    );
});
