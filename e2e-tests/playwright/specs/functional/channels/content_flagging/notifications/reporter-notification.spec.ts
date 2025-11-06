// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import {makeClient} from 'lib/dist/server';

async function setupContentFlagging(adminClient: any, reviewerUserIDs: string[], enable = true) {
    await adminClient.saveContentFlaggingConfig({
        EnableContentFlagging: enable,
        NotificationSettings: {
            EventTargetMapping: {
                assigned: ['reviewers', 'author'],
                dismissed: ['reporter'],
                flagged: ['reviewers', 'author'],
                removed: ['reporter'],
            },
        },
        ReviewerSettings: {
            CommonReviewers: true,
            CommonReviewerIds: reviewerUserIDs,
            TeamReviewersSetting: {},
            SystemAdminsAsReviewers: true,
            TeamAdminsAsReviewers: true,
        },
        AdditionalSettings: {
            Reasons: ['Inappropriate content', 'Spam', 'Harassment', 'Other'],
            ReporterCommentRequired: true,
            ReviewerCommentRequired: true,
            HideFlaggedContent: true,
        },
    });
    return adminClient;
}

async function createPost(userClient: any, team: any, user: any, message: string) {
    const channels = await userClient.getMyChannels(team.id);
    const townSquare = channels.find((ch: any) => ch.name === 'town-square');

    if (!townSquare) throw new Error('Town Square channel not found');

    const post = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    return {post, message, townSquare};
}

async function verifyReporterNotification(channelsPage: any, teamName: string, expectedMessage: string) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    const lastPostId = await channelsPage.centerView.getLastPostID();
    const post = await channelsPage.centerView.getPostById(lastPostId);
    await expect(post.body).toContainText(expectedMessage);
}

/**
 * @objective Verify Reporter is notified if the flagged post is Retained by the reviewer
 */
test('Verify Reporter is notified if flagged post is Retained in a channel', async ({pw}) => {
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient} = await pw.initSetup();

    // Create second user and add to team
    const reporterUser = await pw.random.user('second');
    const {id: reporterUserID} = await adminClient.createUser(reporterUser, '', '');
    await adminClient.addToTeam(team.id, reporterUserID);

    // Create third user and add to team
    const postFromThirdUser = await pw.random.user('third');
    const {id: postFromThirdUserID} = await adminClient.createUser(postFromThirdUser, '', '');
    await adminClient.addToTeam(team.id, postFromThirdUserID);

    const {client: thirdUserClient} = await makeClient(postFromThirdUser);
    const {client: reporterUserClient} = await makeClient(reporterUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);
    const message = `Post by @${reviewerUser.username}, is flagged once`;

    const {post, townSquare} = await createPost(thirdUserClient, team, postFromThirdUser, message);

    await reporterUserClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');
    await reviewerUserClient.keepFlaggedPost(post.id, 'Retaining this post after review');

    const {channelsPage} = await pw.testBrowser.login(reporterUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const expected = `The post having ID ${post.id} in the channel ${townSquare.display_name} which you flagged for review has been restored by a reviewer.`;
    await verifyReporterNotification(channelsPage, team.name, expected);
});

/**
 * @objective Verify Reporter is notified if flagged post is Removed from a channel
 */
test('Verify Reporter is notified if flagged post is Removed from a channel', async ({pw}) => {
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient} = await pw.initSetup();

    // Create second user and add to team
    const reporterUser = await pw.random.user('second');
    const {id: reporterUserID} = await adminClient.createUser(reporterUser, '', '');
    await adminClient.addToTeam(team.id, reporterUserID);

    // Create third user and add to team
    const postFromThirdUser = await pw.random.user('third');
    const {id: postFromThirdUserID} = await adminClient.createUser(postFromThirdUser, '', '');
    await adminClient.addToTeam(team.id, postFromThirdUserID);

    const {client: thirdUserClient} = await makeClient(postFromThirdUser);
    const {client: reporterUserClient} = await makeClient(reporterUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);
    const message = `Post by @${reviewerUser.username}, is flagged once`;

    const {post, townSquare} = await createPost(thirdUserClient, team, postFromThirdUser, message);

    await reporterUserClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');
    await reviewerUserClient.removeFlaggedPost(post.id, 'Retaining this post after review');

    const {channelsPage} = await pw.testBrowser.login(reporterUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const expected = `The post having ID ${post.id} in the channel ${townSquare.display_name} which you flagged for review has been permanently removed by a reviewer.`;
    await verifyReporterNotification(channelsPage, team.name, expected);
});
