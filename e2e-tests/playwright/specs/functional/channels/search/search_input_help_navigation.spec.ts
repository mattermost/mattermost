// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, formatMessage, Msg, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a wildcard (*) is disregarded when it is not immediately preceded by text.
 */
test('MM-T351 disregards a wildcard that is not preceded by text', {tag: '@search'}, async ({pw}) => {
    // # Post two messages, one with a longer variant of the search term
    const {user, team, userClient, townSquare} = await pw.initSetup();
    const token = `qwerty${pw.random.id()}`;
    await userClient.createPost({channel_id: townSquare.id, message: `${token}jkl`});
    const exact = await userClient.createPost({channel_id: townSquare.id, message: token});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Search using a trailing wildcard separated by a space
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(`${token} *`);
    await app.searchBox.inputSearchbox.press('Enter');

    // * Verify the wildcard is disregarded and the exact-term message is returned
    await expect(app.search.results.post(exact).message.container).toContainText(token);
});

/**
 * @objective Verify that the top navigation buttons remain clickable and open their panels while focus is in the search box.
 */
test('MM-T367 clicks top navigation buttons while the search box has focus', {tag: '@search'}, async ({pw}) => {
    const {user, team, townSquare} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // The open search box traps focus and marks the top-right header buttons aria-hidden; the generated buttons are
    // located by testid, so they are still reached. (The channel-info button lives in the channel header, which the
    // search popup overlays, so it is not reachable while the search box is open and is not exercised here.)

    // # Put focus in the search box and type text, then click Recent mentions
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill('some text');
    await app.globalHeader.recentMentionsButton.click();

    // * Verify the Recent Mentions panel opens
    await expect(app.search.header).toContainText(formatMessage(Msg.search_header.title2));

    // # Focus the search box again and click Saved messages
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill('some text');
    await app.globalHeader.savedMessagesButton.click();

    // * Verify the Saved messages panel opens
    await expect(app.search.header).toContainText(formatMessage(Msg.search_header.title3));
});

/**
 * @objective Verify that the search box shows help text when opened from the channel and again after opening a thread.
 */
test('MM-T370 shows search help text when the search box is opened', {tag: '@search'}, async ({pw}) => {
    // # Post a message
    const {user, team, userClient, townSquare} = await pw.initSetup();
    const post = await userClient.createPost({channel_id: townSquare.id, message: `help text ${pw.random.id()}`});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the search box
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);

    // * Verify the search help text is shown
    const hints = app.searchBox.hints;
    await expect(hints).toContainText(formatMessage(Msg.search_hint.filter));

    // # Close the search box, then open a thread
    await app.searchBox.inputSearchbox.press('Escape');
    await expect(app.searchBox.inputSearchbox).not.toBeVisible();
    const centerPost = app.center.postList.post(post);
    await centerPost.container.hover();
    await centerPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);

    // * Verify the search help text is shown again
    await expect(hints).toContainText(formatMessage(Msg.search_hint.filter));
});
