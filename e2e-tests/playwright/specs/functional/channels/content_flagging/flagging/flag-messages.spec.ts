// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// NOTE: No global afterAll disabling content flagging here. A global afterAll
// that writes shared server config races with reviewer-* tests running in a
// parallel worker on the same shard. Each test that needs content flagging
// disabled sets it explicitly at the start (see the "feature is disabled" test
// below). Tests that need it enabled do the same via patchConfig/setupContentFlagging.

// Constants for repeated strings
const FLAG_REASON_CLASSIFICATION_MISMATCH: string = 'Classification Mismatch';
const FLAG_REASON_CLASSIFICATION_MISMATCH_ALT: string = 'Classification mismatch';
const FLAG_COMMENT: string = 'This message contains misclassified data';
const systemMessageForUser = (username: string): string =>
    `The message from @${username} has been quarantined for review. You will be notified once it is reviewed by a Reviewer.`;

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
    reason: string = FLAG_REASON_CLASSIFICATION_MISMATCH,
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
    // Explicitly set HideFlaggedContent: true — a parallel worker may have set it
    // to false (e.g. author-deletes-message-before-review.spec.ts). Without an
    // explicit value this test would fail intermittently under PW_WORKERS=2.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: true,
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user);
    const message = 'This is a test message to be flagged';
    const {post, postId} = await postMessage(channelsPage, message);
    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: true},
        },
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

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
    await expect(systemMessage.body).toContainText(systemMessageForUser(user.username));
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

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false},
        },
    });

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
    await expect(systemMessage.body).toContainText(systemMessageForUser(user.username));
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
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await adminClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT, FLAG_COMMENT);

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    // Town Square may show join/system posts above the target — select by post id.
    const post = await channelsPage.centerView.getPostById(postToBeflagged.id);

    // Re-apply guard immediately before dot-menu: login takes 3-5 s during which a
    // concurrent initSetup() can reset EnableContentFlagging to false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false},
        },
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

    // Try to flag already flagged post
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
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

    // Re-apply guard before UI interaction: a concurrent initSetup() may have reset
    // EnableContentFlagging or reviewer settings between the initial patchConfig and here.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false},
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
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

    // Login as the second user
    const channelsPage = await loginAndNavigate(pw, secondUser, team.name, 'town-square');
    const post = await channelsPage.centerView.getPostById(postToBeflagged.id);

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

    // Re-apply guard: parallel tests often turn flagging back on; the menu item only hides when false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: false,
        },
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === false;
    });

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
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
            },
        },
    });

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
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
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
                ReporterCommentRequired: true,
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
                ReporterCommentRequired: true,
            },
        },
    });

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
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
    // Only set the fields this test actually needs. Omitting ReviewerSettings.CommonReviewerIds
    // prevents racing with reviewer-* tests that set their own reviewer list — a patchConfig
    // that includes CommonReviewerIds replaces the array for ALL concurrent tests on the same
    // server, causing reviewer-actions.spec.ts to lose its notification recipients.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            ReviewerSettings: {
                SystemAdminsAsReviewers: true,
            },
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });

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
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH_ALT, FLAG_COMMENT);

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false or
    // SystemAdminsAsReviewers: false between the initial patchConfig and the remove call.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            ReviewerSettings: {
                SystemAdminsAsReviewers: true,
            },
            AdditionalSettings: {
                HideFlaggedContent: false,
            },
        },
    });
    await adminClient.removeFlaggedPost(postToBeflagged.id, 'Removing this post after review');

    // Login as the user
    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const lastPostId = await channelsPage.centerView.getLastPostID();
    expect(lastPostId).not.toBe(postToBeflagged.id);
});
