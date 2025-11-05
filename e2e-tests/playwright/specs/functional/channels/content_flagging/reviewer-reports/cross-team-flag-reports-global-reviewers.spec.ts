// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

async function createPost(adminClient: any, userClient: any, team: any, user: any, message = '') {
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((ch: any) => ch.name === 'town-square');
    if (!townSquare) throw new Error('Town Square channel not found');

    const post = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    });

    return {post, message, townSquare};
}

/**
 * Helper: Verify flagged post card details in the Content Review DM
 */
async function verifyFlaggedPostCardDetails(
    postID: string,
    channelsPage: any,
    contentReviewPage: any,
    team: any,
    expectedMessage: string,
) {
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    await contentReviewPage.setReportCardByPostID(postID);
    await contentReviewPage.waitForPageLoaded();

    await contentReviewPage.verifyFlaggedPostStatus('Pending');
    await contentReviewPage.verifyFlaggedPostReason('Inappropriate content');
    await contentReviewPage.verifyFlaggedPostMessage(expectedMessage);
}

/**
 * Helper: Verify flagged post details inside the RHS view
 */
async function verifyRHSFlaggedPostDetails(
    postID: string,
    contentReviewPage: any,
    postedByUsername: string,
    flaggedByUsername: string,
    postMessageFlagged: string,
    reasonToFlag: string,
    flagPostReviewStatus: string,
    postFlaggedInChannel: string,
) {
    await contentReviewPage.setReportCardByPostID(postID);
    await contentReviewPage.openViewDetails();
    await contentReviewPage.waitForRHSVisible();

    await contentReviewPage.expectSelectProperty('Status', flagPostReviewStatus);
    await contentReviewPage.expectSelectProperty('Reason', reasonToFlag);
    await contentReviewPage.expectMessageContains(postMessageFlagged);
    await contentReviewPage.expectUser('Flagged by', flaggedByUsername);
    await contentReviewPage.expectUser('Posted by', postedByUsername);
    await contentReviewPage.expectChannel(postFlaggedInChannel);
}

/**
 * @objective Verify a reviewer from other team can receive a review request for a flagged post
 * @testcase
 * 1. Create two teams and users
 * 2. Setup content flagging with reviewers from both teams
 * 3. Create a post in team A and flag it
 * 4. Verify that a reviewer from team B receives a review request in Content Review channel
 */
test('Verify reviewer from another team can receive a review request for a flagged post', async ({pw}) => {
    const reasonToFlag = 'Inappropriate content';
    const flagPostReviewStatus = 'Pending';
    const flagPostComment = 'This message is inappropriate';

    const {adminClient, team, user, userClient, adminUser} = await pw.initSetup();
    const secondTeam = await userClient.createTeam(await pw.random.team('team', 'Team', 'O', true));

    const secondUser = await pw.random.user('mentioned');
    const {id: secondUserID} = await adminClient.createUser(secondUser, '', '');
    await adminClient.addToTeam(secondTeam.id, secondUserID);

    // Configure content flagging
    await adminClient.saveContentFlaggingConfig({
        EnableContentFlagging: true,
        NotificationSettings: {
            EventTargetMapping: {
                assigned: ['reviewers', 'author'],
                dismissed: ['reporter', 'author', 'reviewers'],
                flagged: ['reviewers', 'author'],
                removed: ['author', 'reporter', 'reviewers'],
            },
        },
        ReviewerSettings: {
            CommonReviewers: true,
            CommonReviewerIds: [user.id, adminUser.id, secondUserID],
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

    // Create and flag post
    const message = `Post by @${user.username}, is flagged once`;
    const {post, townSquare} = await createPost(adminClient, userClient, team, user, message);
    await adminClient.flagPost(post.id, reasonToFlag, flagPostComment);

    // Reviewer logs in and verifies flagged post in content review
    const {channelsPage, contentReviewPage} = await pw.testBrowser.login(secondUser);

    await verifyFlaggedPostCardDetails(post.id, channelsPage, contentReviewPage, secondTeam, message);
    await verifyRHSFlaggedPostDetails(
        post.id,
        contentReviewPage,
        user.username,
        adminUser.username,
        message,
        reasonToFlag,
        flagPostReviewStatus,
        townSquare.display_name,
    );
});
