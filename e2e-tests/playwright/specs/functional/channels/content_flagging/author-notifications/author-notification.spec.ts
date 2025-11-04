// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Author is notified if the post is flagged in a channel
 * @testcase
 * 1. Enable Content Flagging with appropriate settings
 * 2. Post a message in a channel as a user
 * 3. Flag the post created
 * 4. Login as user and navigate to Content Review channel
 * 5. Verify that author is notified about the flagged post
 */
test("Verify Author is notified if the post is flagged in a channel", async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: [user.id],
            },
            NotificationSettings: {
                EventTargetMapping: {
                    assigned: ['reviewers', 'author'],
                    dismissed: ['reporter', 'author', 'reviewers'],
                    flagged: ['reviewers', 'author'],
                    removed: ['author', 'reporter', 'reviewers'],
                },
            },
            AdditionalSettings: {
                HideFlaggedContent: true,
            },
        },
    });

    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    await adminClient.flagPost(postToBeflagged.id, 'Inappropriate content', 'This message is inappropriate');

    // Login as the user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@content-review`);
    await channelsPage.toBeVisible();

    const authorNotifiedPostAboutFlaggedPost = `Your post having ID ${postToBeflagged.id} in the channel ${townSquare.display_name} has been flagged for review.`;
    const lastPostId = await channelsPage.centerView.getLastPostID();
    const post = await channelsPage.centerView.getPostById(lastPostId);
    await expect(post.body).toContainText(authorNotifiedPostAboutFlaggedPost);
});

/**
 * @objective Verify Author is notified if flagged post is Retained by the reviewer
 * @testcase
 * 1. Enable Content Flagging with appropriate settings
 * 2. Post a message in a channel as a user
 * 3. Flag the post created
 * 4. Retain the flagged post after review
 * 5. Login as user and navigate to Content Review channel
 * 6. Verify that author is notified about the retention of flagged post
 */
test("Verify Author is notified if flagged post is removed from a channel", async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: [user.id],
            },
            NotificationSettings: {
                EventTargetMapping: {
                    assigned: ['reviewers', 'author'],
                    dismissed: ['reporter', 'author', 'reviewers'],
                    flagged: ['reviewers', 'author'],
                    removed: ['author', 'reporter', 'reviewers'],
                },
            },
            AdditionalSettings: {
                HideFlaggedContent: true,
            },
        },
    });

    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const message = `Post by @${user.username}, is flagged once`;
    const postToBeflagged = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    await adminClient.flagPost(postToBeflagged.id, 'Inappropriate content', 'This message is inappropriate');
    await adminClient.keepFlaggedPost(postToBeflagged.id, 'Removing this post after review');

    // Login as the user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@content-review`);
    await channelsPage.toBeVisible();

    const authorNotifiedPostAboutFlaggedPostRetained = `Your post having ID ${postToBeflagged.id} in the channel ${townSquare.display_name} which was flagged for review has been restored by a reviewer.`;
    const lastPostId = await channelsPage.centerView.getLastPostID();
    const post = await channelsPage.centerView.getPostById(lastPostId);
    await expect(post.body).toContainText(authorNotifiedPostAboutFlaggedPostRetained);

});
