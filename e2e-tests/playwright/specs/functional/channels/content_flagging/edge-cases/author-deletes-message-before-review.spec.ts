// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
            HideFlaggedContent: false,
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

async function verifyAuthorNotification(
    postID: string,
    channelsPage: any,
    contentReviewPage: any,
    teamName: string,
    expectedMessage: string,
) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    await contentReviewPage.setReportCardByPostID(postID);
    await contentReviewPage.waitForPageLoaded();

    await contentReviewPage.verifyFlaggedPostStatus('Pending');
    await contentReviewPage.verifyFlaggedPostReason('Inappropriate content');
    await contentReviewPage.verifyFlaggedPostMessage(expectedMessage);
}
/**
 * @objective Verify that when the author deletes a flagged message before review,
 * the flag status is updated to "Removed" and the report reflects the deletion.
 */
// TODO: Fix defect https://mattermost.atlassian.net/browse/MM-66588
test.skip('should update flag status and report when author deletes flagged message', async ({pw}) => {
        const {adminClient, team, user: reviewerUser} = await pw.initSetup();
        // Create second user and add to team
        const reporterUser = await pw.random.user('second');
        const {id: reporterUserID} = await adminClient.createUser(reporterUser, '', '');
        await adminClient.addToTeam(team.id, reporterUserID);

        // Create third user and add to team
        const postFromThirdUser = await pw.random.user('third');
        const {id: postFromThirdUserID} = await adminClient.createUser(postFromThirdUser, '', '');
        await adminClient.addToTeam(team.id, postFromThirdUserID);

        const {client: thirdUserClient} = await pw.makeClient(postFromThirdUser);
        const {client: reporterUserClient} = await pw.makeClient(reporterUser);

        await setupContentFlagging(adminClient, [reviewerUser.id]);
        const message = `Post by @${reviewerUser.username}, is flagged once`;

        const {post} = await createPost(thirdUserClient, team, postFromThirdUser, message);

        await reporterUserClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');

        // delete the post as the author
        await thirdUserClient.deletePost(post.id);

        // verify the flag status is updated to "Removed"
        const flagReport = await adminClient.getFlaggedPost(post.id);

        console.log('Flag Report:', flagReport);
        // Verify the delete_at timestamp is set (indicating deletion)
        expect(flagReport.delete_at).not.toBe(0);

        const {channelsPage, contentReviewPage} = await pw.testBrowser.login(reviewerUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        await verifyAuthorNotification(post.id, channelsPage, contentReviewPage, team.name, message);

});