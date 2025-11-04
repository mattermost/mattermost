// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Helper function to open the dot menu for a given post
 */
async function openPostDotMenu(post: any, channelsPage: any) {
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
}

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

    // 1. Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);

    const post = await channelsPage.getLastPost();
    const postId = await channelsPage.centerView.getLastPostID();
    
    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);

    // Cancel flagging the message
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 3. Flag the message
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate content');
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 4. Verify the message is flagged
    await channelsPage.centerView.messageDeletedVisible(true, postId, message);
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
    const {user, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });

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

    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);

    // Cancel flagging the message
    await channelsPage.centerView.flagPostConfirmationDialog.cancelButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();

    // 3. Flag the message
    await openPostDotMenu(post, channelsPage);
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
test('Verify user cannot flag already flagged message', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
            NotificationSettings: {
                EventTargetMapping: {
                    assigned: ['reviewers'],
                    dismissed: ['reporter', 'author', 'reviewers'],
                    flagged: ['reviewers'],
                    removed: ['author', 'reporter', 'reviewers'],
                },
            },
        },
    });

    const secondUser = await pw.random.user('mentioned');
    const {id: secondUserID} = await adminClient.createUser(secondUser, '', '');

    // # Add the mentioned user to the team
    await adminClient.addToTeam(team.id, secondUserID);
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    await adminClient.flagPost(postToBeflagged.id, 'Inappropriate content', 'This message is inappropriate');

    // Login as the second user
    const {channelsPage} = await pw.testBrowser.login(secondUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const post = await channelsPage.getLastPost();
    
    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate Content');
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.cannotFlagAlreadyFlaggedPostToBeVisible();
});

/**
 * @objective: Test that user cannot flag a message that was previously retained.
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Retain the message as a reviewer
 * 5. Attempt to flag the retained message again
 * 6. Verify that the message cannot be flagged again
 */
test('Verify user cannot flag a message that was previously retained', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();

    const secondUser = await pw.random.user('mentioned-');
    const {id: secondUserID, username: secondUsername} = await adminClient.createUser(secondUser, '', '');

    // # Add the mentioned user to the team
    await adminClient.addToTeam(team.id, secondUserID);
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
            NotificationSettings: {
                EventTargetMapping: {
                    assigned: ['reviewers'],
                    dismissed: ['reporter', 'author', 'reviewers'],
                    flagged: ['reviewers'],
                    removed: ['author', 'reporter', 'reviewers'],
                },
            },
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: [ user.id, secondUserID],
            },
        },
    });

    const message = `Post by @${secondUsername}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: secondUserID,
    });

    await adminClient.flagPost(postToBeflagged.id, 'Inappropriate content', 'This message is inappropriate');
    await adminClient.keepFlaggedPost(postToBeflagged.id, 'Retaining this post after review');

    // Login as the second user
    const {channelsPage} = await pw.testBrowser.login(secondUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const post = await channelsPage.getLastPost();

    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Inappropriate Content');
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment('This message is inappropriate');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.cannotFlagPreviouslyRetainedPostToBeVisible();
});

/**
 * @objective: Test that flag message option is not available when Content Flagging feature is disabled
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Verify that flag message option is not available in the post menu
 */
test('Verify the Flag message option is not available when feature is disabled', async ({pw}) => {
    const {user, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: false,
        },
    });

    // 1. Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);

    const post = await channelsPage.getLastPost();

    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItemNotToBeVisible();
});

test('Verify Flagging reason dropdown', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons : [
                    'Spam',
                    'Inappropriate Content',
                    'Harassment',
                    'Hate Speech',
                    'Other',
                ]
        }},
    });

    // Login as the user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);
    
    const post = await channelsPage.getLastPost();

    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Spam');
});

test('Verify Comments are required for Flagging', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons : [
                    'Spam',
                    'Inappropriate Content',
                    'Harassment',
                    'Hate Speech',
                    'Other',
                ],
                ReporterCommentRequired: true,
        }},
    });

    // Login as the user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    
    const message = 'This is a test message to be flagged';
    await channelsPage.postMessage(message);
    
    const post = await channelsPage.getLastPost();

    // open the dot menu
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Spam');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.requireCommentsForFlaggingPost();
});
