// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    FLAG_COMMENT,
    FLAG_REASON_CLASSIFICATION_MISMATCH,
    FLAG_REASON_CLASSIFICATION_MISMATCH_ALT,
    loginAndNavigate,
    openPostDotMenu,
} from './support';

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
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT, FLAG_COMMENT);

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    const post = await channelsPage.getLastPost();

    // Try to flag already flagged post
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
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
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT, FLAG_COMMENT);
    await adminClient.keepFlaggedPost(postToBeflagged.id, 'Retaining this post after review');

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    const post = await channelsPage.getLastPost();

    // Try to flag previously retained post
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment(FLAG_COMMENT);
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.cannotFlagPreviouslyRetainedPostToBeVisible();
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
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT, FLAG_COMMENT);
    await adminClient.removeFlaggedPost(postToBeflagged.id, 'Removing this post after review');

    // Login as the user
    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const lastPostId = await channelsPage.centerView.getLastPostID();
    expect(lastPostId).not.toBe(postToBeflagged.id);
});
