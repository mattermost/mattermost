// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createPost, verifyAuthorNotification, setupContentFlagging} from './../support';

/**
 * @objective Verify that when the author deletes a flagged message before review,
 * the flag status is updated to "Removed" and the report reflects the deletion.
 */
// TODO: Fix defect https://mattermost.atlassian.net/browse/MM-66342
test.skip('should not be able to restore flagged messages when author deletes message', async ({pw}) => {
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

    await setupContentFlagging(adminClient, [reviewerUser.id], true, false);
    const message = `Post by @${reviewerUser.username}, is flagged once`;

    const {post} = await createPost(adminClient, thirdUserClient, team, postFromThirdUser, message);

    await reporterUserClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');

    // delete the post as the author
    await thirdUserClient.deletePost(post.id);

    // verify the flag status is updated to "Removed"
    const flagReport = await adminClient.getFlaggedPost(post.id);

    // Verify the delete_at timestamp is set (indicating deletion)
    expect(flagReport.delete_at).not.toBe(0);

    const {channelsPage, contentReviewPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    await verifyAuthorNotification(post.id, channelsPage, contentReviewPage, team.name, message, 'Removed');
});
