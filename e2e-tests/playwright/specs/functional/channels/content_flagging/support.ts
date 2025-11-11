// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@mattermost/playwright-lib';

export async function setupContentFlagging(adminClient: any, reviewerUserIDs: string[], enable = true) {
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
    channelsPage: any,
    teamName: string,
    expectedMessage: string,
    postID: string,
    contentReviewPage: any,
    status: string,
) {
    await channelsPage.goto(teamName, '@content-review');
    await channelsPage.toBeVisible();

    await contentReviewPage.setReportCardByPostID(postID);
    await contentReviewPage.waitForPageLoaded();

    await contentReviewPage.verifyFlaggedPostStatus(status);
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
