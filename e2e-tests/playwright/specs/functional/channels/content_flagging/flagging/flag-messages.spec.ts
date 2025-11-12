// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// Constants for repeated strings
const FLAG_REASON_INAPPROPRIATE: string = 'Inappropriate Content';
const FLAG_REASON_INAPPROPRIATE_ALT: string = 'Inappropriate content';
const FLAG_COMMENT: string = 'This message is inappropriate';
const SYSTEM_MESSAGE = (username: string): string =>
    `The message from @${username} has been flagged for review. You will be notified once it is reviewed by a Content Reviewer. `;

// Helper to login and navigate to channel
async function loginAndNavigate(pw: any, user: any, teamName?: string, channelName?: string): Promise<any> {
    const {channelsPage} = await pw.testBrowser.login(user);
    if (teamName && channelName) {
        await channelsPage.goto(teamName, channelName);
    } else {
        await channelsPage.goto();
    }
    await channelsPage.toBeVisible();
    return channelsPage;
}

// Helper to post a message and get post info
async function postMessage(channelsPage: any, message: string): Promise<{post: any; postId: any}> {
    await channelsPage.postMessage(message);
    const post = await channelsPage.getLastPost();
    const postId = await channelsPage.centerView.getLastPostID();
    return {post, postId};
}

// Helper to flag a post
async function flagPostFlow(
    post: any,
    channelsPage: any,
    message: string,
    reason: string = FLAG_REASON_INAPPROPRIATE,
    comment: string = FLAG_COMMENT,
): Promise<void> {
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(reason);
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment(comment);
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();
}

// Helper to open the dot menu for a given post
async function openPostDotMenu(post: any, channelsPage: any): Promise<void> {
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
    await flagPostFlow(post, channelsPage, message, FLAG_REASON_INAPPROPRIATE_ALT);

    // Verify the message is flagged
    await channelsPage.centerView.messageDeletedVisible(true, postId, message);
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
    await adminClient.addToTeam(team.id, secondUserID);
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');
    if (!townSquare) throw new Error('Town Square channel not found');

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_INAPPROPRIATE_ALT, FLAG_COMMENT);

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    const post = await channelsPage.getLastPost();

    // Try to flag already flagged post
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_INAPPROPRIATE);
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment(FLAG_COMMENT);
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
    await adminClient.addToTeam(team.id, secondUserID);
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');
    if (!townSquare) throw new Error('Town Square channel not found');

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
                CommonReviewerIds: [user.id, secondUserID],
            },
        },
    });

    const message = `Post by @${secondUsername}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: secondUserID,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_INAPPROPRIATE_ALT, FLAG_COMMENT);
    await adminClient.keepFlaggedPost(postToBeflagged.id, 'Retaining this post after review');

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    const post = await channelsPage.getLastPost();

    // Try to flag previously retained post
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_INAPPROPRIATE);
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment(FLAG_COMMENT);
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

    const channelsPage = await loginAndNavigate(pw, user);
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItemNotToBeVisible();
});

/**
 * @objective: Verify Flagging reason dropdown options
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Open flag message dialog
 * 4. Verify the flagging reason dropdown options
 */
test('Verify Flagging reason dropdown', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_INAPPROPRIATE, 'Harassment', 'Hate Speech', 'Other'],
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Spam');
});

/**
 * @objective: Verify Comments are required for Flagging
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Open flag message dialog
 * 4. Verify that comments are required for flagging
 */
test('Verify Comments are required for Flagging', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_INAPPROPRIATE, 'Harassment', 'Hate Speech', 'Other'],
                ReporterCommentRequired: true,
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason('Spam');
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.requireCommentsForFlaggingPost();
});

/**
 * @objective: Verify message is removed from channel if the reviewer removed the message
 *
 * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Flag the message
 * 4. Login as a reviewer and remove the message
 * 5. Verify the message is removed from the channel
 */
test('Verify message is removed from channel if the reviewer removed the message', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: [user.id],
            },
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });

    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');
    if (!townSquare) throw new Error('Town Square channel not found');

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_INAPPROPRIATE_ALT, FLAG_COMMENT);
    await adminClient.removeFlaggedPost(postToBeflagged.id, 'Removing this post after review');

    // Login as the user
    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const lastPostId = await channelsPage.centerView.getLastPostID();
    expect(lastPostId).not.toBe(postToBeflagged.id);
});
