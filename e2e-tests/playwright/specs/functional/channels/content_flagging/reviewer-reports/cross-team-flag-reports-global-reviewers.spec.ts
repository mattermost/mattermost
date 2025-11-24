// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {createPost, verifyFlaggedPostCardDetails, verifyRHSFlaggedPostDetails} from './../support';

/**
 * @objective Verify a reviewer from other team can receive a review request for a flagged post
 * @testcase
 * 1. Create two teams and users
 * 2. Setup content flagging with reviewers from both teams
 * 3. Create a post in team A and flag it
 * 4. Verify that a reviewer from team B receives a review request in Content Review channel
 * 5. Verify the flagged post details in the reviewer's Content Review DM and RHS
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
