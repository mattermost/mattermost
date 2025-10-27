// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective: Test the basic flow of flagging a message
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Verify the message is flagged
 */
test('Enable content flagging Feature', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
        },
    });
    const testUser2 = await adminClient.createUser(await pw.random.user('other'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // 1. Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);

    const post = await channelsPage.getLastPost();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);

    // Cancel flagging the message
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 3. Flag the message
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate content');
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 4. Verify the message is flagged
    await channelsPage.messageDeletedVisible(true);
    const systemMessage = await channelsPage.getLastPost();
    await expect(systemMessage.body).toContainText(
        `The message from @${user.username} has been flagged for review. You will be notified once it is reviewed by a Content Reviewer. `,
    );
});

/**
 * @objective: Verify Post is not hidden after flagging if HideFlaggedContent is false
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Verify the message is not hidden
 */
test('Verify Post is not hidden after flagging if HideFlaggedContent is false', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });
    const testUser2 = await adminClient.createUser(await pw.random.user('other'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // 1. Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);

    const post = await channelsPage.getLastPost();
    const postId = await channelsPage.centerView.getLastPostID();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);

    // Cancel flagging the message
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 3. Flag the message
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate Content');
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 4. Verify the message is flagged
    const originaltext = await channelsPage.centerView.getPostById(postId);
    await expect(originaltext.body).toContainText(message);

    const systemMessage = await channelsPage.getLastPost();
    await expect(systemMessage.body).toContainText(
        `The message from @${user.username} has been flagged for review. You will be notified once it is reviewed by a Content Reviewer. `,
    );
});

/**
 * @objective: Test that another user cannot flag an already flagged message
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Login as another user
 * 5. Attempt to flag the already flagged message
 * 6. Verify that the message cannot be flagged again
 */
test('Flag Message - Another User Attempts to Flag Already Flagged Message', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });
    const testUser2 = await adminClient.createUser(await pw.random.user('other'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // 1. Login as the first user
    const {channelsPage: channelsPageUser1} = await pw.testBrowser.login(user);
    await channelsPageUser1.goto();
    await channelsPageUser1.toBeVisible();

    // 2. Post a message
    const message = 'This is a test message to be flagged';
    await channelsPageUser1.postMessage(message);

    const post = await channelsPageUser1.getLastPost();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPageUser1.postDotMenu.toBeVisible();
    await channelsPageUser1.postDotMenu.flagMessageMenuItem.click();
    await channelsPageUser1.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPageUser1.centerView.flagPostConfirmationDialog.toContainPostText(message);

    // 3. Flag the message
    await channelsPageUser1.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate content');
    await channelsPageUser1.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPageUser1.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPageUser1.centerView.flagPostConfirmationDialog.notToBeVisible();

    await pw.testBrowser.logout();

    // 4. Login as another user
    const {channelsPage: channelsPageUser2} = await pw.testBrowser.login(testUser2);
    await channelsPageUser2.goto();
    await channelsPageUser2.toBeVisible();
});
