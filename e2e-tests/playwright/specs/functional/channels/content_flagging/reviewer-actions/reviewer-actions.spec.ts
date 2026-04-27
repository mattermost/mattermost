// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupContentFlagging, createPost, verifyAuthorNotification} from './../support';

/** @objective Verify Retained and Removed Flagged posts do not appear in RHS after once reviewed
 * @testcase
 * 1. Create three users and add them as reviewers to a team
 * 2. Setup content flagging with the three users as reviewers
 * 3. Create a post and flag it
 * 4. As Reviewer 1, Retain the flagged post and verify the status is updated to 'Retained'
 * 5. As Reviewer 2, Verify the flagged post status is 'Retained'
 */
test('Verify Removed Flagged posts show appropriate status and do not show the post message', async ({pw}) => {
    const {adminClient, team, user, userClient, adminUser} = await pw.initSetup();

    // Create second user and add to team
    const secondUser = await pw.random.user('reviewer');
    const {id: secondUserID} = await adminClient.createUser(secondUser, '', '');
    await adminClient.addToTeam(team.id, secondUserID);
    // Make system_admin so SystemAdminsAsReviewers: true covers them even if
    // CommonReviewerIds is reset to [] by a concurrent initSetup() call.
    await adminClient.updateUserRoles(secondUserID, 'system_user system_admin');

    // Create third user and add to team
    const thirdUser = await pw.random.user('reviewer');
    const {id: thirdUserID} = await adminClient.createUser(thirdUser, '', '');
    await adminClient.addToTeam(team.id, thirdUserID);
    await adminClient.updateUserRoles(thirdUserID, 'system_user system_admin');

    // Setup content flagging *after* roles are set
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);

    const message = `Post by @${user.username}, is flagged once`;

    const {post} = await createPost(adminClient, userClient, team, user, message);
    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging: false
    // between the initial setupContentFlagging call and the flagPost call.
    // pw.waitUntil confirms the config is actually true before proceeding — this
    // closes the race window to < 100 ms (time between final poll and flagPost).
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message is inappropriate');

    const {channelsPage: secondChannelsPage, contentReviewPage: secondContentReviewPage} =
        await pw.testBrowser.login(secondUser);
    await verifyAuthorNotification(post.id, secondChannelsPage, secondContentReviewPage, team.name, message, 'Pending');

    const commentRemove = 'Removing this message as it violates the guidelines.';
    const contentModerationMessage = 'Content deleted as part of Content Flagging review process';
    await secondContentReviewPage.setReportCardByPostID(post.id);
    await secondContentReviewPage.openViewDetails();
    await secondContentReviewPage.waitForRHSVisible();

    await secondContentReviewPage.openViewDetails();
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });
    await secondContentReviewPage.clickRemoveMessage();
    await secondContentReviewPage.enterConfirmationComment(commentRemove);
    await secondContentReviewPage.confirmRemove();
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);

    const {channelsPage: channelsPageThird, contentReviewPage: contentReviewPageThird} =
        await pw.testBrowser.login(thirdUser);
    await verifyAuthorNotification(
        post.id,
        channelsPageThird,
        contentReviewPageThird,
        team.name,
        contentModerationMessage,
        'Removed',
    );
});
