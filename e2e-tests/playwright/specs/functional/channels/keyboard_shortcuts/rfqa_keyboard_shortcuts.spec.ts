// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify keyboard shortcuts modal opens from Ctrl/Cmd+/ and /shortcuts and can be closed.
 */
test('MM-T1239 CTRL/CMD+/ and /shortcuts open keyboard shortcuts', {tag: '@rfqa'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Open the keyboard shortcuts modal with the shortcut
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ControlOrMeta+/');

    // * Verify the shortcuts modal opens
    const modal = page.getByRole('dialog', {name: /Keyboard shortcuts/});
    await expect(modal).toBeVisible();

    // # Close and reopen the modal with the slash command
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await channelsPage.postMessage('/shortcuts');

    // * Verify the slash command opens the same modal
    await expect(modal).toBeVisible();
});

/**
 * @objective Verify Ctrl/Cmd+K channel switch keeps focus so typed characters are not lost.
 */
test('MM-T1242 CTRL/CMD+K typed characters are not lost after switching channels', {tag: '@rfqa'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const message = 'Hello World!';

    // # Open quick switcher, select the current channel, and type into the focused page
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.locator('#quickSwitchInput')).toBeVisible();
    await page.locator('#quickSwitchInput').fill('off');
    await page.locator('#suggestionList').getByTestId('off-topic').getByText('Off-Topic', {exact: true}).click();
    await channelsPage.centerView.header.toHaveTitle('Off-Topic');
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.type(message);

    // * Verify typed characters land in the post textbox
    await expect(channelsPage.centerView.postCreate.input).toHaveValue(message);
});

/**
 * @objective Verify Ctrl/Cmd+Up and Ctrl/Cmd+Down cycle through previous messages in the post textbox.
 */
test('MM-T1254 CTRL/CMD+UP and CTRL/CMD+DOWN cycle previous messages', {tag: '@rfqa'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const messages = ['post 1', 'post 2', 'post 3', 'post 4', 'post 5'];

    // # Post several messages and focus the textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    for (const message of messages) {
        await channelsPage.postMessage(message);
    }
    await channelsPage.centerView.postCreate.input.focus();

    // * Verify Ctrl/Cmd+Up cycles backward through message history
    for (const message of [...messages].reverse()) {
        await page.keyboard.press('ControlOrMeta+ArrowUp');
        await expect(channelsPage.centerView.postCreate.input).toHaveValue(message);
    }

    // * Verify Ctrl/Cmd+Down cycles forward through message history
    for (const message of messages.slice(1)) {
        await page.keyboard.press('ControlOrMeta+ArrowDown');
        await expect(channelsPage.centerView.postCreate.input).toHaveValue(message);
    }
});

/**
 * @objective Verify Up arrow opens inline edit for the previous message and saving marks the post as edited.
 */
test('MM-T1260 UP arrow edits the previous post', {tag: '@rfqa'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Post a message and press Up from the center textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('Test');
    const postId = await channelsPage.centerView.getLastPostID();
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');

    // # Edit and save the previous message
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage('Edit Test');
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the post was edited and has the edited marker
    const editedPost = await channelsPage.getLastPost();
    await editedPost.toContainText('Edit Test');
    await expect(channelsPage.centerView.editedPostIcon(postId)).toContainText('Edited');
});
