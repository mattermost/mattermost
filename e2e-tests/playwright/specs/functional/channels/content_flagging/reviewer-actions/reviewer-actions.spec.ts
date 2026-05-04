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

    // Create third user and add to team
    const thirdUser = await pw.random.user('reviewer');
    const {id: thirdUserID} = await adminClient.createUser(thirdUser, '', '');
    await adminClient.addToTeam(team.id, thirdUserID);

    // Setup content flagging *after* roles are set
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID, thirdUserID]);

    const message = `Post by @${user.username}, is flagged once`;

    const {post} = await createPost(adminClient, userClient, team, user, message);
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
    await secondContentReviewPage.clickRemoveMessage();
    await secondContentReviewPage.enterConfirmationComment(commentRemove);

    // New multi-step flow: Continue → wait for report to generate → Remove permanently
    await secondContentReviewPage.submitFormAndWaitForReport();
    await secondContentReviewPage.confirmRemovePermanently();

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
