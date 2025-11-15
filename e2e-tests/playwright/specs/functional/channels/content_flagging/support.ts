// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@mattermost/playwright-lib';

export async function setupContentFlagging(
    adminClient: any,
    userIds: string[],
    enable = true,
    hideFlaggedContent = true,
) {
    // Configure content flagging
    await adminClient.saveContentFlaggingConfig({
        EnableContentFlagging: enable,
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
            CommonReviewerIds: userIds,
            TeamReviewersSetting: {},
            SystemAdminsAsReviewers: true,
            TeamAdminsAsReviewers: true,
        },
        AdditionalSettings: {
            Reasons: ['Inappropriate content', 'Spam', 'Harassment', 'Other'],
            ReporterCommentRequired: true,
            ReviewerCommentRequired: true,
            HideFlaggedContent: hideFlaggedContent,
        },
    });
    return adminClient;
}

export async function createPost(adminClient: any, userClient: any, team: any, user: any, message: string) {
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

export async function verifyAuthorNotification(
    postID: string,
    channelsPage: any,
    contentReviewPage: any,
    teamName: string,
    expectedMessage: string,
    postStatus: string,
) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    await contentReviewPage.setReportCardByPostID(postID);
    await contentReviewPage.waitForPageLoaded();

    await contentReviewPage.verifyFlaggedPostStatus(postStatus);
    await contentReviewPage.verifyFlaggedPostReason('Inappropriate content');
    await contentReviewPage.verifyFlaggedPostMessage(expectedMessage);
}

/**
 * Verify flagged post details inside the RHS view
 */
export async function verifyRHSFlaggedPostDetails(
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
 * Verify flagged post card details in the Content Review DM
 */
export async function verifyFlaggedPostCardDetails(
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

export async function verifyReporterNotification(channelsPage: any, teamName: string, expectedMessage: string) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    const lastPostId = await channelsPage.centerView.getLastPostID();
    const post = await channelsPage.centerView.getPostById(lastPostId);
    await expect(post.body).toContainText(expectedMessage);
}
