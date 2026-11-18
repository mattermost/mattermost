// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {
    DefaultChannel,
    expect,
    Msg,
    settle,
    test,
    type App,
    type PlaywrightExtended,
    Api,
} from '@mattermost/playwright-lib';

// NOTE: No global afterAll disabling content flagging here. A global afterAll
// that writes shared server config races with reviewer-* tests running in a
// parallel worker on the same shard. Each test that needs content flagging
// disabled sets it explicitly at the start (see the "feature is disabled" test
// below). Tests that need it enabled do the same via patchConfig/setupContentFlagging.

// Constants for repeated strings
const FLAG_REASON_CLASSIFICATION_MISMATCH: string = 'Classification mismatch';

// Sent by every patchConfig below: the reason list is server-wide and replaced as a whole, so a
// test cannot rely on the one another test left behind.
const FLAG_REASONS: string[] = ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'];
const FLAG_COMMENT: string = 'This message contains misclassified data';
const systemMessageForUser = (username: string): string =>
    `The message from @${username} has been quarantined for review. You will be notified once it is reviewed by a Reviewer.`;

// Logs the user in and opens the team's Town Square.
async function loginAndNavigate(pw: PlaywrightExtended, user: UserProfile, team: {name: string}): Promise<App> {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    return app;
}

// The center channel's last post id (waits for there to be one).
async function lastPostId(app: App): Promise<string> {
    await expect.poll(async () => (await app.center.postList.postList.keys()).length).toBeGreaterThan(0);
    const keys = await app.center.postList.postList.keys();
    return keys[keys.length - 1];
}

// Posts a message from the composer and returns the post (by id) once it shows.
async function postMessage(app: App, message: string) {
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect
        .poll(async () => app.center.postList.post({id: await lastPostId(app)}).message.container.text())
        .toBe(message);
    const postId = await lastPostId(app);
    return {post: app.center.postList.post({id: postId}), postId};
}

type CenterPost = ReturnType<App['center']['postList']['post']>;

// Opens a post's dot menu.
async function openPostDotMenu(app: App, post: CenterPost) {
    await post.container.hover();
    await post.menu.dotMenuButton.click();
    await expect(app.postDotMenu.container).toBeVisible();
    return app.postDotMenu;
}

// Opens the quarantine dialog from a post's dot menu.
async function openFlagDialog(app: App, post: CenterPost) {
    const dialog = await (await openPostDotMenu(app, post)).flagMenuItem.clickTo(app.flagPostModal);
    await expect(dialog.confirmButton).toBeVisible();
    return dialog;
}

// Flags a post through the quarantine dialog.
async function flagPostFlow(
    app: App,
    post: CenterPost,
    message: string,
    reason: string = FLAG_REASON_CLASSIFICATION_MISMATCH,
    comment: string = FLAG_COMMENT,
): Promise<void> {
    const dialog = await openFlagDialog(app, post);
    await expect(dialog.postPreview.message.container).toContainText(message);
    await dialog.reasonCombobox.choose(reason);
    await expect(dialog.reasonValueText).toHaveText(reason);
    await dialog.comment.container.fill(comment);
    await settle(dialog.confirmButton, {wait: Api.PostCFPostFlag}).click();
    await expect(dialog.confirmButton).not.toBeVisible();
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
    const {user, adminClient, team} = await pw.initSetup();
    // Explicitly set HideFlaggedContent: true — a parallel worker may have set it
    // to false (e.g. author-deletes-message-before-review.spec.ts). Without an
    // explicit value this test would fail intermittently under PW_WORKERS=2.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: true,
                Reasons: FLAG_REASONS,
            },
        },
    });

    const app = await loginAndNavigate(pw, user, team);
    const message = 'This is a test message to be flagged';
    const {post, postId} = await postMessage(app, message);
    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: true, Reasons: FLAG_REASONS},
        },
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

    // Cancel flagging the message
    const flagDialog = await openFlagDialog(app, post);
    await expect(flagDialog.postPreview.message.container).toContainText(message);
    await flagDialog.cancelButton.click();
    await expect(flagDialog.confirmButton).not.toBeVisible();

    // Flag the message
    await flagPostFlow(app, post, message, FLAG_REASON_CLASSIFICATION_MISMATCH);

    // Verify the message is flagged
    await expect(app.center.postList.post({id: postId})).toContainMessage(Msg.post_body.deleted);
    await expect
        .poll(async () => app.center.postList.post({id: await lastPostId(app)}).locator.textContent())
        .toContain(systemMessageForUser(user.username));
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
                Reasons: FLAG_REASONS,
            },
        },
    });

    const app = await loginAndNavigate(pw, user, team);
    const message = 'This is a test message to be flagged';
    const {post, postId} = await postMessage(app, message);
    await expect(post).toBeVisible();

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false, Reasons: FLAG_REASONS},
        },
    });

    // Cancel flagging the message
    const flagDialog = await openFlagDialog(app, post);
    await expect(flagDialog.postPreview.message.container).toContainText(message);
    await flagDialog.cancelButton.click();
    await expect(flagDialog.confirmButton).not.toBeVisible();

    // Flag the message
    await flagPostFlow(app, post, message);

    // Verify the message is flagged
    await expect(app.center.postList.post({id: postId}).message.container).toContainText(message);
    await expect
        .poll(async () => app.center.postList.post({id: await lastPostId(app)}).locator.textContent())
        .toContain(systemMessageForUser(user.username));
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
                Reasons: FLAG_REASONS,
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
    const townSquare = channels.find((channel) => channel.name === DefaultChannel.TownSquare);
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await pw.postAs(user, {
        channel_id: townSquare.id,
        message,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH, FLAG_COMMENT);

    // Login as the second user
    const app = await loginAndNavigate(pw, secondUser, team);
    // Town Square may show join/system posts above the target — select by post id.
    const post = app.center.postList.post({id: postToBeflagged.id});

    // Re-apply guard immediately before dot-menu: login takes 3-5 s during which a
    // concurrent initSetup() can reset EnableContentFlagging to false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false, Reasons: FLAG_REASONS},
        },
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

    // Try to flag already flagged post
    const flagDialog = await openFlagDialog(app, post);
    await flagDialog.reasonCombobox.choose(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await expect(flagDialog.reasonValueText).toHaveText(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await flagDialog.comment.container.fill(FLAG_COMMENT);
    await flagDialog.confirmButton.click();
    await expect(flagDialog.confirmButton).toBeVisible();
    await expect(flagDialog.requestErrorText).toHaveText(
        'Cannot quarantine this post as it is already quarantined for review.',
    );
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
    const townSquare = channels.find((channel) => channel.name === DefaultChannel.TownSquare);
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                HideFlaggedContent: false,
                Reasons: FLAG_REASONS,
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
    const postToBeflagged = await pw.postAs(secondUser, {
        channel_id: townSquare.id,
        message,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH, FLAG_COMMENT);
    await adminClient.keepFlaggedPost(postToBeflagged.id, 'Retaining this post after review');

    // Re-apply guard before UI interaction: a concurrent initSetup() may have reset
    // EnableContentFlagging or reviewer settings between the initial patchConfig and here.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {HideFlaggedContent: false, Reasons: FLAG_REASONS},
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
    const app = await loginAndNavigate(pw, secondUser, team);
    const post = app.center.postList.post({id: postToBeflagged.id});

    // Try to flag previously retained post
    const flagDialog = await openFlagDialog(app, post);
    await expect(flagDialog.postPreview.message.container).toContainText(message);
    await flagDialog.reasonCombobox.choose(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await expect(flagDialog.reasonValueText).toHaveText(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await flagDialog.comment.container.fill(FLAG_COMMENT);
    await flagDialog.confirmButton.click();
    await expect(flagDialog.confirmButton).toBeVisible();
    await expect(flagDialog.requestErrorText).toHaveText(
        'Cannot quarantine this post as it was retained in a previous review.',
    );
});

/**
 * @objective: Test that flag message option is not available when Content Flagging feature is disabled
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Verify that flag message option is not available in the post menu
 */
test('Verify the Quarantine for Review option is not available when feature is disabled', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: false,
        },
    });

    const app = await loginAndNavigate(pw, user, team);
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(app, message);

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

    const dotMenu = await openPostDotMenu(app, post);
    await expect(dotMenu.copyLinkMenuItem).toBeVisible();
    await expect(dotMenu.flagMenuItem).not.toBeVisible();
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
                Reasons: FLAG_REASONS,
            },
        },
    });

    const app = await loginAndNavigate(pw, user, team);
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(app, message);

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: FLAG_REASONS,
            },
        },
    });

    const flagDialog = await openFlagDialog(app, post);
    await expect(flagDialog.postPreview.message.container).toContainText(message);
    await flagDialog.reasonCombobox.choose(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await expect(flagDialog.reasonValueText).toHaveText(FLAG_REASON_CLASSIFICATION_MISMATCH);
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
                Reasons: FLAG_REASONS,
                ReporterCommentRequired: true,
            },
        },
    });

    const app = await loginAndNavigate(pw, user, team);
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(app, message);

    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false.
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: FLAG_REASONS,
                ReporterCommentRequired: true,
            },
        },
    });

    const flagDialog = await openFlagDialog(app, post);
    await expect(flagDialog.postPreview.message.container).toContainText(message);
    await flagDialog.reasonCombobox.choose(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await expect(flagDialog.reasonValueText).toHaveText(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await flagDialog.confirmButton.click();
    await expect(flagDialog.confirmButton).toBeVisible();
    await expect(flagDialog.comment.errorText).toHaveMessage(Msg.quarantine_message_modal.empty_comment_error);
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
                Reasons: FLAG_REASONS,
            },
        },
    });

    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === DefaultChannel.TownSquare);
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await pw.postAs(user, {
        channel_id: townSquare.id,
        message,
    });
    await adminClient.flagPost(postToBeflagged.id, FLAG_REASON_CLASSIFICATION_MISMATCH, FLAG_COMMENT);

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
                Reasons: FLAG_REASONS,
            },
        },
    });
    await adminClient.removeFlaggedPost(postToBeflagged.id, 'Removing this post after review');

    // Login as the user
    const app = await loginAndNavigate(pw, user, team);
    expect(await lastPostId(app)).not.toBe(postToBeflagged.id);
    await expect(app.center.postList.post(postToBeflagged)).toHaveCount(0);
});
