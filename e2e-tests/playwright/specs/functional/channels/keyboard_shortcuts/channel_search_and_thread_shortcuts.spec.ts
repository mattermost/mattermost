// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+K can search for and open a direct message by @username, a group message
 * with the mouse, and a public channel.
 *
 * MM-T1245 and MM-T1246 overlap the group-message and direct-message portions of MM-T1247, so the
 * three keys share one setup while retaining each original Cypress interaction and assertion.
 */
test(
    'MM-T1245 MM-T1246 MM-T1247 finds and opens direct messages, group messages, and channels with CTRL/CMD+K',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'switch');

        // # Create a direct message, a group message, and a public channel for the test user
        const directMessage = await adminClient.createDirectChannel([user.id, member1.id]);
        await adminClient.createPost({
            channel_id: directMessage.id,
            user_id: member1.id,
            message: 'Direct message for quick switch',
        });
        const groupMessage = await adminClient.createGroupChannel([user.id, member1.id, member2.id]);
        await adminClient.createPost({
            channel_id: groupMessage.id,
            user_id: member2.id,
            message: 'Group message for quick switch',
        });
        const publicChannel = await adminClient.createPublicChannel(team.id, `Switcher ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, publicChannel.id);

        // # Log in and open Town Square
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const {findChannelsModal} = channelsPage;

        // # Open Find Channels and search with @ followed by the start of member1's username
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(`@${member1.username.slice(0, 3)}`);
        await findChannelsModal.getDirectMessageOption(member1.username, member2.username).click();

        // * Verify member1's direct-message channel opens
        await expect(page).toHaveURL(new RegExp(`/${team.name}/messages/@${member1.username}$`));
        await channelsPage.centerView.header.toHaveTitle(member1.username);

        // # Reopen Find Channels, search for member2, and click the group-message option with the mouse
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(member2.username);
        await findChannelsModal.getGroupMessageOption([member1.username, member2.username]).click();

        // * Verify the group-message intro and both other members are visible
        await expect(channelsPage.centerView.channelIntro).toContainText(
            'This is the start of your group message history with these teammates',
        );
        await channelsPage.centerView.header.toHaveTitle(member1.username);
        await channelsPage.centerView.header.toHaveTitle(member2.username);

        // # Reopen Find Channels, search for the public channel, and click its option
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(publicChannel.display_name);
        await findChannelsModal.getOption(new RegExp(publicChannel.display_name)).click();

        // * Verify the public channel opens
        await channelsPage.centerView.header.toHaveTitle(publicChannel.display_name);
        await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${publicChannel.name}$`));
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

        // # Initialize setup with admin and user
        const {adminUser, user, team} = await pw.initSetup();

        // # Log in as admin in one browser session
        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, 'town-square');
        await adminChannelsPage.toBeVisible();

        // # Have admin post the root message for the thread
        await adminChannelsPage.centerView.postCreate.postMessage(ROOT_MESSAGE);

        // # Have admin open the thread and post multiple replies with attachments
        const rootPost = await adminChannelsPage.getLastPost();
        await rootPost.hover();
        await rootPost.postMenu.toBeVisible();
        await rootPost.postMenu.reply();

        // * Verify RHS is visible for admin
        await adminChannelsPage.sidebarRight.toBeVisible();

        // # Firstly let admin create a series of random replies to the root message
        for (let i = 1; i <= NUMBER_OF_REPLIES; i++) {
            await adminChannelsPage.sidebarRight.postCreate.postMessage(`Random replies number ${i}`.repeat(40));
        }

        // # Secondly let admin create a series of random replies to the root message with attachments
        for (const file of ATTACHMENT_FILES) {
            await adminChannelsPage.sidebarRight.postCreate.postMessage(
                `Random replies number with attachment: ${file}`,
                [file],
            );
        }

        // # Admin closes the RHS
        await adminChannelsPage.sidebarRight.close();

        // # Log in as regular user in a separate browser session
        const {channelsPage: userChannelsPage, page: userPage} = await pw.testBrowser.login(user);
        await userChannelsPage.goto(team.name, 'town-square');
        await userChannelsPage.toBeVisible();

        // # Bring focus to the post textbox in center channel
        await userChannelsPage.centerView.postCreate.input.focus();

        // * Verify the post textbox in center channel is focused
        await expect(userChannelsPage.centerView.postCreate.input).toBeFocused();

        // # Press Shift+Up to open the latest thread in the channel in the RHS
        await userPage.keyboard.press('Shift+ArrowUp');

        // * Verify RHS is visible
        await userChannelsPage.sidebarRight.toBeVisible();

        // * Verify the correct thread (admin's root message) is shown in RHS
        await userChannelsPage.sidebarRight.toContainText(ROOT_MESSAGE);

        // * Verify RHS reply textbox is focused only
        await expect(userChannelsPage.sidebarRight.postCreate.input).toBeFocused();

        // # Type a message to verify the textbox can receive input immediately
        await userPage.keyboard.type('Reply typed after Shift+Up');

        // * Verify the message was typed into the RHS textbox
        const inputValue = await userChannelsPage.sidebarRight.postCreate.getInputValue();
        expect(inputValue).toBe('Reply typed after Shift+Up');

        // # Clear the input and close RHS
        await userChannelsPage.sidebarRight.postCreate.input.clear();
        await userChannelsPage.sidebarRight.close();
    },
);

/**
 * @objective Verify Ctrl/Cmd+. opens and closes the right-hand sidebar.
 */
test(
    'MM-T4692 opens and closes the right sidebar with the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post a message and open its reply thread in the right sidebar
        await channelsPage.centerView.postCreate.postMessage('this post is from today');
        const post = await channelsPage.getLastPost();
        await post.openAThread();
        await channelsPage.sidebarRight.toBeVisible();

        // # Press the toggle shortcut to close the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is closed
        await expect(channelsPage.sidebarRight.container).not.toBeVisible();

        // # Press the toggle shortcut again to reopen the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is shown again with the reply thread
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.toContainText('this post is from today');
    },
);
