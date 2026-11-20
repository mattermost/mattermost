// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, settle, Api, postWith, waitForApi} from '@mattermost/playwright-lib';

/** Sends through the declared composer and returns its new post. */
async function send(app: App, message: string, rhs = false) {
    const composer = rhs ? app.rhs.postCreate : app.center.postCreate;
    const posts = rhs ? app.rhs.thread : app.center.postList;
    await composer.message.container.fill(message);
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    return postWith(posts, {text: message});
}

// Settings controls have no declared parts; only channel posts and the RHS use generated scopes.
let keywords: string[];
const highlightWithoutNotificationClass = 'non-notification-highlight';

test.beforeEach(async ({pw}) => {
    keywords = [`AB${pw.random.id()}`, `CD${pw.random.id()}`, `EF${pw.random.id()}`, `Highlight me ${pw.random.id()}`];
});

test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    await send(app, 'Hello World');

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    const keywordsInput = await notificationsSettings.getKeywordsInput();

    // # Enter keyword 1
    await keywordsInput.fill(keywords[0]);

    // # Press Comma on the textbox
    await keywordsInput.press(',');
    await expect(keywordsInput).toHaveValue('');

    // # Enter keyword 2
    await keywordsInput.fill(keywords[1]);

    // # Press Tab on the textbox
    await keywordsInput.press('Tab');
    await expect(keywordsInput).toHaveValue('');

    // # Enter keyword 3
    await keywordsInput.fill(keywords[2]);

    // # Press Enter on the textbox
    await Promise.all([waitForApi(app.page, Api.PatchUserMe), keywordsInput.press('Enter')]);

    // * Verify that the keywords have been added to the collapsed description
    const keysWithHighlightDesc = notificationsSettings.keysWithHighlightDesc;
    await expect(keysWithHighlightDesc).toBeVisible();
    for (const keyword of keywords.slice(0, 3)) {
        await expect(keysWithHighlightDesc).toContainText(keyword);
    }
});

test('MM-T5465-2 Should highlight the keywords when a message is sent with the keyword in center', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

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
    await expect(keywordsInput).toHaveValue('');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await send(app, messageWithoutKeyword);
    const lastPostWithoutHighlight = await postWith(app.center.postList, {text: messageWithoutKeyword});

    // Highlight CSS belongs to the rendered text; the generated post bounds these native checks.
    // * Verify that the keywords are not highlighted
    await expect(lastPostWithoutHighlight.container.locator.getByText(messageWithoutKeyword)).toBeVisible();
    await expect(lastPostWithoutHighlight.container.locator.getByText(messageWithoutKeyword)).not.toHaveClass(
        highlightWithoutNotificationClass,
    );

    // # Post a message with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await send(app, messageWithKeyword);
    const lastPostWithHighlight = await postWith(app.center.postList, {text: messageWithKeyword});

    // * Verify that the keywords are highlighted
    await expect(lastPostWithHighlight.container.locator.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.locator.getByText(keywords[3])).toHaveClass(
        highlightWithoutNotificationClass,
    );
});

test('MM-T5465-3 Should highlight the keywords when a message is sent with the keyword in rhs', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

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
    await expect(keywordsInput).toHaveValue('');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    await send(app, messageWithoutKeyword);
    const lastPostWithoutHighlight = await postWith(app.center.postList, {text: messageWithoutKeyword});

    // # Open the message in the RHS
    await lastPostWithoutHighlight.container.hover();
    await expect(lastPostWithoutHighlight.menu.replyButton).toBeVisible();
    await lastPostWithoutHighlight.menu.replyButton.clickTo(app.rhs.container);
    await expect(app.rhs.container).toBeVisible();

    // # Post a message with the keyword in the RHS
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    await send(app, messageWithKeyword, true);

    // * Verify that the keywords are highlighted
    const lastPostWithHighlightInRHS = await postWith(app.rhs.thread, {text: messageWithKeyword});
    await expect(lastPostWithHighlightInRHS.container.locator.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlightInRHS.container.locator.getByText(keywords[3])).toHaveClass(
        highlightWithoutNotificationClass,
    );
});

test('MM-T5465-4 Highlighted keywords should not appear in the Recent Mentions', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

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
    await expect(keywordsInput).toHaveValue('');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Open the recent mentions
    await app.globalHeader.recentMentionsButton.clickTo(app.rhs.container);

    // * Verify recent mentions is empty
    await expect(app.rhs.container).toBeVisible();
    await expect(app.rhs.locator.getByText('No mentions yet')).toBeVisible();
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
    const {channelsPage, app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

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
    await expect(keywordsInput).toHaveValue('');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // * Verify that the keywords are highlighted in the last message received
    const lastPostWithHighlight = await postWith(app.center.postList, {text: messageWithKeyword});
    await expect(lastPostWithHighlight.container.locator.getByText(messageWithKeyword)).toBeVisible();
    await expect(lastPostWithHighlight.container.locator.getByText(highlightKeyword)).toHaveClass(
        highlightWithoutNotificationClass,
    );
});
