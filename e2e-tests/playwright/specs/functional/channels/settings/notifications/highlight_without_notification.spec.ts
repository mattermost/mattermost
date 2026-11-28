// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type App, expect, test, Msg, Api, settle} from '@mattermost/playwright-lib';

let keywords: string[];

test.beforeEach(async ({pw}) => {
    keywords = [`AB${pw.random.id()}`, `CD${pw.random.id()}`, `EF${pw.random.id()}`, `Highlight me ${pw.random.id()}`];
});

/** Opens Settings > Notifications and expands "Keywords that get highlighted (without notifications)". */
async function openHighlightKeywords(app: App) {
    await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('notifications').select();
    await expect(app.userSettingsModal.tabs.tab('notifications')).toBeSelected();
    const section = app.settings.notifications.section('keywordsAndHighlight');
    await section.editButton.click();
    await expect(section.keywordsCombobox).toBeVisible();
    return section;
}

/** Adds `keyword` as a highlight keyword, saves, and closes Settings. */
async function saveHighlightKeyword(app: App, keyword: string) {
    const section = await openHighlightKeywords(app);
    await section.keywordsCombobox.fill(keyword);
    await section.keywordsCombobox.press('Tab');
    await expect(section.keywordsCombobox).toHaveValue('');
    await settle(section.saveButton, {wait: Api.PatchUserMe}).click();
    await app.userSettingsModal.closeButton.click();
    await expect(app.userSettingsModal).not.toBeVisible();
}

/** Sends a message from a composer, and returns the list's new post once it shows. */
async function send(
    list: App['center']['postList'] | App['rhs']['thread'],
    composer: App['center']['postCreate'] | App['rhs']['postCreate'],
    message: string,
) {
    await composer.message.container.fill(message);
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    return list.postList.itemWith({text: message});
}

/** The highlighted keywords in a post's message. */
function highlightsIn(post: ReturnType<App['center']['postList']['post']> | ReturnType<App['rhs']['thread']['post']>) {
    return post.markdown.keywordHighlightText;
}

/**
 * @objective Verify that keywords are added when Enter, comma or Tab is pressed in the keywords textbox
 */
test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    await send(app.center.postList, app.center.postCreate, 'Hello World');

    // # Open settings modal, the notifications tab, and expand the keywords that get highlighted section
    const section = await openHighlightKeywords(app);
    const input = section.keywordsCombobox;

    // # Enter the keywords, separated by comma, tab and enter
    await input.fill(keywords[0]);
    await input.press(',');
    await expect(input).toHaveValue('');
    await input.fill(keywords[1]);
    await input.press('Tab');
    await expect(input).toHaveValue('');
    await input.fill(keywords[2]);
    await settle(input, {wait: Api.PatchUserMe}).press('Enter');

    // * Verify the keywords are added to the collapsed description
    await expect(section.describeText).toBeVisible();
    for (const keyword of keywords.slice(0, 3)) {
        await expect(section.describeText).toContainText(keyword);
    }
});

/**
 * @objective Verify that keywords are highlighted in a message sent in the center
 */
test('MM-T5465-2 Should highlight the keywords when a message is sent with the keyword in center', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    // # Save a highlight keyword
    await saveHighlightKeyword(app, keywords[3]);

    // # Post a message without the keyword
    const messageWithoutKeyword = 'This message does not contain the keyword';
    const withoutKeyword = await send(app.center.postList, app.center.postCreate, messageWithoutKeyword);

    // * Verify the message has no highlight
    await expect(withoutKeyword).toContainText(messageWithoutKeyword);
    await expect(withoutKeyword.message.container).toBeVisible();
    await expect(withoutKeyword.message.container).not.toHaveClass('non-notification-highlight');
    await expect(highlightsIn(withoutKeyword)).toHaveCount(0);

    // # Post a message with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    const withKeyword = await send(app.center.postList, app.center.postCreate, messageWithKeyword);

    // * Verify the keyword is highlighted
    await expect(withKeyword).toContainText(messageWithKeyword);
    await expect(highlightsIn(withKeyword)).toHaveText([keywords[3]]);
    await expect(withKeyword.message.container).toBeVisible();
    await expect(highlightsIn(withKeyword)).toBeVisible();
    await expect(highlightsIn(withKeyword)).toHaveClass('non-notification-highlight');
});

/**
 * @objective Verify that keywords are highlighted in a reply sent in the RHS
 */
test('MM-T5465-3 Should highlight the keywords when a message is sent with the keyword in rhs', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    // # Save a highlight keyword
    await saveHighlightKeyword(app, keywords[3]);

    // # Post a message without the keyword, and open it in the RHS
    const root = await send(app.center.postList, app.center.postCreate, 'This message does not contain the keyword');
    await root.container.hover();
    await expect(root.menu.replyButton).toBeVisible();
    await root.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();

    // # Reply with the keyword
    const messageWithKeyword = `This message contains the keyword ${keywords[3]}`;
    const reply = await send(app.rhs.thread, app.rhs.postCreate, messageWithKeyword);

    // * Verify the keyword is highlighted in the reply
    await expect(reply).toContainText(messageWithKeyword);
    await expect(highlightsIn(reply)).toHaveText([keywords[3]]);
    await expect(reply.message.container).toBeVisible();
    await expect(highlightsIn(reply)).toBeVisible();
    await expect(highlightsIn(reply)).toHaveClass('non-notification-highlight');
});

/**
 * @objective Verify that highlighted keywords don't count as mentions
 */
test('MM-T5465-4 Highlighted keywords should not appear in the Recent Mentions', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    // # Save a highlight keyword
    await saveHighlightKeyword(app, keywords[0]);

    // # Open the recent mentions
    await app.globalHeader.recentMentionsButton.click();

    // * Verify recent mentions are empty
    await expect(app.noResults.titleText).toHaveMessage(Msg.no_results.mentions.title);
    await expect(app.noResults.titleText).toBeVisible();
});

/**
 * @objective Verify that keywords are highlighted in a message from another user
 */
test('MM-T5465-5 Should highlight keywords in message sent from another user', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {adminClient, team, adminUser, user, townSquare: channel} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Get the default channel of the team for getting the channel id
    const highlightKeyword = keywords[0];
    const messageWithKeyword = `This received message contains the ${highlightKeyword} keyword `;

    // # Create a post containing the highlighted keyword from the admin
    const post = await adminClient.createPost(
        pw.random.post({
            message: messageWithKeyword,
            channel_id: channel.id,
            user_id: adminUser.id,
        }),
    );

    // # Now log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();

    // # Save the highlight keyword
    await saveHighlightKeyword(app, highlightKeyword);

    // * Verify the keyword is highlighted in the admin's message
    const received = app.center.postList.post(post);
    await expect(received).toContainText(messageWithKeyword.trim());
    await expect(highlightsIn(received)).toHaveText([highlightKeyword]);
    await expect(received.message.container).toBeVisible();
    await expect(highlightsIn(received)).toBeVisible();
    await expect(highlightsIn(received)).toHaveClass('non-notification-highlight');
});
