// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    FLAG_REASON_CLASSIFICATION_MISMATCH_ALT,
    flagPostFlow,
    loginAndNavigate,
    openPostDotMenu,
    postMessage,
    systemMessageForQuarantined,
} from './support';

const SYSTEM_MESSAGE = systemMessageForQuarantined;

/**
 * @objective: Test the basic flow of flagging a message and verify flagged message is hidden
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Verify the message is hidden and a system message is shown
 */
test('Verify flagged message is hidden by default', async ({pw}) => {
    const {user, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
        },
    });

    const channelsPage = await loginAndNavigate(pw, user);
    const message = 'This is a test message to be flagged';
    const {post, postId} = await postMessage(channelsPage, message);

    // Cancel flagging the message
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // Flag the message
    await flagPostFlow(post, channelsPage, message, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT);

    // Verify the message is flagged
    const flaggedPost = await channelsPage.centerView.getPostById(postId);
    await flaggedPost.toContainText('(message deleted)');
    const systemMessage = await channelsPage.getLastPost();
    await expect(systemMessage.body).toContainText(SYSTEM_MESSAGE(user.username));
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
    const {user, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user);
    const message = 'This is a test message to be flagged';
    const {post, postId} = await postMessage(channelsPage, message);
    await post.toBeVisible();

    // Cancel flagging the message
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // Flag the message
    await flagPostFlow(post, channelsPage, message);

    // Verify the message is flagged
    const originaltext = await channelsPage.centerView.getPostById(postId);
    await expect(originaltext.body).toContainText(message);
    const systemMessage = await channelsPage.getLastPost();
    await expect(systemMessage.body).toContainText(SYSTEM_MESSAGE(user.username));
});

/**
 * @objective: Test that flag message option is not available when Content Flagging feature is disabled
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Verify that flag message option is not available in the post menu
 */
test('Verify the Quarantine for Review option is not available when feature is disabled', async ({pw}) => {
    const {user, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: false,
        },
    });

    const channelsPage = await loginAndNavigate(pw, user);
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItemNotToBeVisible();
});
