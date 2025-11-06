// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

async function setupContentFlagging(pw: any, userId: string, enable = true) {
    const {adminClient} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: enable,
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: [userId],
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
    return adminClient;
}

async function createFlaggedPost(adminClient: any, userClient: any, team: any, user: any) {
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((ch: any) => ch.name === 'town-square');

    if (!townSquare) throw new Error('Town Square channel not found');

    const message = `Post by @${user.username}, is flagged once`;
    const post = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    return {post, message, townSquare};
}

async function verifyAuthorNotification(channelsPage: any, teamName: string, expectedMessage: string) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    const lastPostId = await channelsPage.centerView.getLastPostID();
    const post = await channelsPage.centerView.getPostById(lastPostId);
    await expect(post.body).toContainText(expectedMessage);
}

/**
 * @objective Verify Author is notified if the post is flagged in a channel
 */
test('Verify Author is notified if the post is flagged in a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(pw, user.id);

    const {post, townSquare} = await createFlaggedPost(adminClient, userClient, team, user);
    await adminClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');

    const {channelsPage} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} has been flagged for review.`;
    await verifyAuthorNotification(channelsPage, team.name, expected);
});

/**
 * @objective Verify Author is notified if flagged post is Retained by the reviewer
 */
test('Verify Author is notified if flagged post is Retained in a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(pw, user.id);

    const {post, townSquare} = await createFlaggedPost(adminClient, userClient, team, user);
    await adminClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');
    await adminClient.keepFlaggedPost(post.id, 'Retaining this post after review');

    const {channelsPage} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} which was flagged for review has been restored by a reviewer.`;
    await verifyAuthorNotification(channelsPage, team.name, expected);
});

/**
 * @objective Verify Author is notified if flagged post is Removed by the reviewer
 */
test('Verify Author is notified if flagged post is Removed from a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(pw, user.id);

    const {post, townSquare} = await createFlaggedPost(adminClient, userClient, team, user);
    await adminClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');
    await adminClient.removeFlaggedPost(post.id, 'Removing this post after review');

    const {channelsPage} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} which was flagged for review has been permanently removed by a reviewer.`;
    await verifyAuthorNotification(channelsPage, team.name, expected);
});
