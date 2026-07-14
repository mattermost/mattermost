// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can view a message's edit history and restore a previous version, and that
 * cancelling the restore confirmation keeps the edited version.
 */
test('MM-T5537 views message edit history and restores a previous version', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message
    const message = 'This is a message to post and then edit';
    await channelsPage.postMessage(message);

    // # Open the inline edit box for the last post, append text, and save
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.input.press('End');
    await channelsPage.centerView.postEdit.input.pressSequentially('. I have now edited this message.');
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the post shows the edited text
    const editedMessage = `${message}. I have now edited this message.`;
    const post = await channelsPage.getLastPost();
    await post.toContainText(editedMessage);

    // # Open the edit history from the "Edited" indicator
    await post.openEditHistory();
    await channelsPage.sidebarRight.toBeVisible();

    // # Open the restore confirmation for the previous version, then cancel it
    await channelsPage.sidebarRight.restorePreviousPostVersionIcon.first().click();
    const restoreModal = channelsPage.centerView.postEdit.restorePostConfirmationDialog;
    await restoreModal.toBeVisible();
    await restoreModal.cancelButton.click();
    await restoreModal.notToBeVisible();

    // * Verify the edited version is still displayed
    await post.toContainText(editedMessage);

    // # Restore the previous version and confirm
    await channelsPage.sidebarRight.restorePreviousPostVersionIcon.first().click();
    await restoreModal.toBeVisible();
    await restoreModal.confirmRestore();
    await restoreModal.notToBeVisible();

    // * Verify the post is reverted to the original message
    const restoredPost = await channelsPage.getLastPost();
    await restoredPost.toContainText(message);
    await restoredPost.toNotContainText('I have now edited this message');
});
