// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the Ctrl/Cmd+K quick switcher can find and open a direct message, a group message,
 * and a public channel.
 */
test(
    'MM-T1247 finds and opens a direct message, group message, and channel with Ctrl/Cmd+K',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'switch');

        // # Create a direct message, a group message, and a public channel for the user
        const dm = await adminClient.createDirectChannel([user.id, member1.id]);
        await adminClient.createPost({channel_id: dm.id, user_id: member1.id, message: 'dm hello'});
        const gm = await adminClient.createGroupChannel([user.id, member1.id, member2.id]);
        await adminClient.createPost({channel_id: gm.id, user_id: member2.id, message: 'gm hello'});
        const publicChannel = await adminClient.createPublicChannel(team.id, `Switcher ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, publicChannel.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {findChannelsModal} = channelsPage;
        const options = () => findChannelsModal.container.getByRole('option');

        // # Open the quick switcher and open the direct message with member1 (the option with only member1)
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(member1.username);
        await options().filter({hasText: member1.username, hasNotText: member2.username}).first().click();

        // * Verify the direct message with member1 is opened
        await channelsPage.centerView.header.toHaveTitle(member1.username);

        // # Open the quick switcher and open the group message (the option containing both members)
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(member2.username);
        await options().filter({hasText: member1.username}).filter({hasText: member2.username}).first().click();

        // * Verify the group message (containing both members) is opened
        await channelsPage.centerView.header.toHaveTitle(member1.username);
        await channelsPage.centerView.header.toHaveTitle(member2.username);

        // # Open the quick switcher and open the public channel
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(publicChannel.display_name);
        await options().filter({hasText: publicChannel.display_name}).first().click();

        // * Verify the public channel is opened
        await channelsPage.centerView.header.toHaveTitle(publicChannel.display_name);
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
