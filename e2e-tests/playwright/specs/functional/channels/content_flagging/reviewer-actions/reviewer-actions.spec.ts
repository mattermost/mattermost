// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupContentFlagging, createPost, verifyAuthorNotification} from './../support';

/** @objective Verify Removed Flagged posts show appropriate status and do not show the post message
 * @testcase
 * 1. Create three users and add them as reviewers to a team
 * 2. Setup content flagging with the three users as reviewers
 * 3. Create a post and flag it
 * 4. As Reviewer 1, walk through the multi-step removal flow (form → report generated → remove permanently)
 * 5. As Reviewer 2, verify the flagged post status is 'Removed' and the message has been replaced
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

    // Re-apply guard: concurrent initSetup() may have reset config between flagPost and login
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

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

    // New multi-step flow: Continue → wait for report to generate → Remove permanently
    await secondContentReviewPage.submitFormAndWaitForReport();
    await secondContentReviewPage.confirmRemovePermanently();
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);

    // After the remove action succeeds, the reviewer's own view of the flagged
    // post should be replaced with the moderation placeholder rather than the
    // original message that is now cleared from the redux store (MM-69043).
    // The placeholder appears both in the RHS detail view and in the report
    // card shown in the @content-review center channel — assert each scope
    // separately so a regression in either location is caught.
    await secondContentReviewPage.verifyFlaggedPostMessageInRHS(contentModerationMessage);
    await secondContentReviewPage.verifyFlaggedPostMessageInCenter(post.id, contentModerationMessage);

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
