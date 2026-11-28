// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAsset} from '@/asset';
import {expect, test, type App, Api, settle} from '@mattermost/playwright-lib';

/**
 * Opens the channel switcher with Ctrl/Cmd+K, searches, and opens the result: the person's row, or the one row whose
 * text contains `rowText`. The shortcut is pressed in the message box, which also waits for the app to be up (a
 * generated `goto` returns on page load).
 */
async function switchTo(app: App, search: string, rowText?: string) {
    await app.center.postCreate.message.container.pressTo('ControlOrMeta+K', app.quickSwitchModal);
    await app.quickSwitchModal.searchTextbox.fill(search);
    const {suggestions} = app.quickSwitchModal;
    await expect(app.quickSwitchModal.searchTextbox).toHaveValue(search);

    // A row's testid carries the term the switcher builds for it, which a spec cannot know (a channel id, a person's
    // id before their direct message is loaded): the row is found by what it shows.
    const row =
        rowText === undefined
            ? await suggestions.suggestionList.first()
            : await suggestions.suggestionList.itemWith({text: rowText});
    await row.select();
    await expect(app.quickSwitchModal).not.toBeVisible();
}

/**
 * @objective Verify the Ctrl/Cmd+K quick switcher can find and open a direct message, a group message,
 * and a public channel.
 */
test(
    'MM-T1247 finds and opens a direct message, group message, and channel with Ctrl/Cmd+K',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {adminClient, team, user, townSquare} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'switch');

        // # Create a direct message, a group message, and a public channel for the user
        const dm = await adminClient.createDirectChannel([user.id, member1.id]);
        await pw.postAs(member1, {channel_id: dm.id, message: 'dm hello'});
        const gm = await adminClient.createGroupChannel([user.id, member1.id, member2.id]);
        await pw.postAs(member2, {channel_id: gm.id, message: 'gm hello'});
        const publicChannel = await adminClient.createPublicChannel(team.id, `Switcher ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, publicChannel.id);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        const title = app.channelHeader.openMenuButton;

        // # Open the quick switcher and open the direct message with member1
        await switchTo(app, member1.username);

        // * Verify the direct message with member1 is opened
        await expect(page).toHavePath(
            app.channelsPage.pathFor({team, path: 'messages', channel: `@${member1.username}`}),
        );
        await expect(title).toContainText(member1.username);

        // # Open the quick switcher and open the group message
        // (a group message's row lists its members, comma separated; a person's row does not)
        await switchTo(app, member2.username, ', ');

        // * Verify the group message (containing both members) is opened
        await expect(page).toHavePath(app.channelsPage.pathFor({team, path: 'messages', channel: gm.name}));
        await expect(title).toContainText(member1.username);
        await expect(title).toContainText(member2.username);

        // # Open the quick switcher and open the public channel
        await switchTo(app, publicChannel.display_name, publicChannel.display_name);

        // * Verify the public channel is opened
        await expect(title).toContainText(publicChannel.display_name);
    },
);

/**
 * @objective Verify that pressing Shift+Up in the textbox in center channel opens the thread for the last post in RHS
 * and correctly focuses the reply textbox, even when there are large messages with attachments from other users.
 */
test(
    'MM-T1275 Keyboard shortcuts Shift+Up on center textbox opens the last post in the RHS and correctly focuses the reply textbox',
    {tag: '@keyboard_shortcuts'},
    async ({pw}, testInfo) => {
        const ROOT_MESSAGE = 'The root message for testing Shift+Up keyboard shortcut';
        const NUMBER_OF_REPLIES = 10;
        const ATTACHMENT_FILES = ['mattermost.png', 'sample_text_file.txt', 'archive.zip'];

        test.skip(testInfo.project.name === 'ipad', 'Skipping test on iPad');

        // # Initialize setup with admin and user, and have the admin post the root message
        const {adminUser, adminClient, user, team, townSquare} = await pw.initSetup();
        const root = await adminClient.createPost({channel_id: townSquare.id, message: ROOT_MESSAGE});

        // # Log in as admin, open the thread and post a series of long replies
        const {app: adminApp} = await pw.testBrowser.login(adminUser);
        await adminApp.channelsPage.goto({team, channel: townSquare});
        const rootPost = adminApp.center.postList.post(root);
        await rootPost.container.hover();
        await rootPost.menu.replyButton.click();
        await expect(adminApp.rhs.postCreate.message.container).toBeVisible();
        const rhsComposer = adminApp.rhs.postCreate;
        await expect(rhsComposer.message.container).toBeVisible();

        for (let i = 1; i <= NUMBER_OF_REPLIES; i++) {
            await rhsComposer.message.container.fill(`Random replies number ${i}`.repeat(40));
            await settle(rhsComposer.sendButton, {wait: Api.CreatePost}).click();
            await expect(rhsComposer.message.container).toHaveValue('');
        }

        // # Then post replies with attachments
        for (const file of ATTACHMENT_FILES) {
            await settle(rhsComposer.uploadInput, {wait: Api.UploadFile}).chooseFiles(getAsset(file));
            await expect(rhsComposer.filePreviews.fileList).toHaveKeyCount(1);
            await rhsComposer.message.container.fill(`Random replies number with attachment: ${file}`);
            await settle(rhsComposer.sendButton, {wait: Api.CreatePost}).click();
            await expect(rhsComposer.filePreviews.fileList).toHaveKeyCount(0);
        }
        await expect
            .poll(async () => (await adminApp.rhs.thread.postList.keys()).length)
            .toBe(1 + NUMBER_OF_REPLIES + ATTACHMENT_FILES.length);

        // # Admin closes the RHS
        await adminApp.rhs.thread.header.closeButton.click();
        await expect(adminApp.rhs.thread.header.closeButton).not.toBeVisible();

        // # Log in as regular user and bring focus to the post textbox in center channel
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        const centerTextbox = app.center.postCreate.message.container;
        await centerTextbox.focus();

        // * Verify the post textbox in center channel is focused
        await expect(centerTextbox).toBeFocused();

        // # Press Shift+Up to open the latest thread in the channel in the RHS
        await page.keyboard.press('Shift+ArrowUp');

        // * Verify the correct thread (admin's root message) is shown in RHS
        await expect(app.rhs.thread.post(root).message.container).toHaveText(ROOT_MESSAGE);

        // * Verify RHS reply textbox is focused
        const rhsTextbox = app.rhs.postCreate.message.container;
        await expect(rhsTextbox).toBeFocused();

        // # Type a message to verify the textbox can receive input immediately
        await page.keyboard.type('Reply typed after Shift+Up');

        // * Verify the message was typed into the RHS textbox
        await expect(rhsTextbox).toHaveValue('Reply typed after Shift+Up');

        // # Clear the input and close RHS
        await rhsTextbox.clear();
        await app.rhs.thread.header.closeButton.click();
        await expect(app.rhs.thread.header.closeButton).not.toBeVisible();
    },
);

/**
 * @objective Verify Ctrl/Cmd+. opens and closes the right-hand sidebar.
 */
test(
    'MM-T4692 opens and closes the right sidebar with the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, userClient, team, townSquare} = await pw.initSetup();
        const message = 'this post is from today';
        const created = await userClient.createPost({channel_id: townSquare.id, message});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the post's reply thread in the right sidebar
        const post = app.center.postList.post(created);
        await post.container.hover();
        await post.menu.replyButton.click();
        await expect(app.rhs.postCreate.message.container).toBeVisible();
        const rhsRoot = app.rhs.thread.post(created).message.container;
        await expect(rhsRoot).toHaveText(message);

        // # Press the toggle shortcut to close the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is closed
        await expect(rhsRoot).not.toBeVisible();

        // # Press the toggle shortcut again to reopen the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is shown again with the reply thread
        await expect(rhsRoot).toHaveText(message);
    },
);
