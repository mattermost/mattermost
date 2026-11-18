// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {
    createPost,
    expectReport,
    openContentReview,
    openReportDetails,
    reportPostId,
    setupContentFlagging,
} from './../support';

/**
 * @objective Verify that a deletion report summary is posted to the reviewer's content review thread after removing a flagged post
 * @testcase
 * 1. Create two users and set one as reviewer
 * 2. Setup content flagging
 * 3. Create a post, flag it, and remove it via reviewer
 * 4. Login as the reviewer and navigate to the content review DM
 * 5. Verify the deletion report summary table is posted in the reviewer's thread
 */
test('Reviewer receives a deletion report summary after removing a flagged post', async ({pw}) => {
    const {adminClient, team, user: reviewerUser} = await pw.initSetup();

    // # Create author user
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `Sensitive 2 post by @${authorUser.username} to be removed`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);
    const expectedFileName = `deletion_report_${post.id}.md`;

    // # Flag the post
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message contains sensitive data');

    // # Login as reviewer and navigate to content review DM
    const {app} = await pw.testBrowser.login(reviewerUser);
    await openContentReview(app, team);
    const reportId = await reportPostId(pw, reviewerUser, post.id);
    await expectReport(app.center.postList.post({id: reportId}).spillageReport.card, {status: 'Pending', message});

    // # Remove the post via the UI. The remove flow still routes through the skip-confirm step (destructive
    // action), unlike the keep flow which now bypasses it.
    await openReportDetails(app, reportId);
    const reviewDialog = await app.rhs.thread
        .post({id: reportId})
        .spillageReport.actions.removeButton.clickTo(app.flaggedMessageModal);
    await reviewDialog.form.comment.container.fill('Removing: data spillage confirmed');
    await reviewDialog.form.downloadReportCheckbox.set(false);
    await expect(reviewDialog.form.downloadReportCheckbox).not.toBeChecked();
    await reviewDialog.form.primaryButton.click();
    await expect(reviewDialog.skipConfirm.primaryButton).toBeVisible();
    await settle(reviewDialog.skipConfirm.primaryButton, {wait: Api.RemoveCFPost}).click();
    await expect(reviewDialog.skipConfirm.primaryButton).not.toBeVisible();

    await openContentReview(app, team);

    // * Verify the removed stub is in the content-review thread
    const removedPost = app.center.postList.post({id: reportId});
    await expect(removedPost).toContainText('Content deleted as part of Content Flagging review process');

    // # Open the thread: the deletion report is posted as a reply, not on the view-details property card.
    await removedPost.threadFooter.replyButton.click();
    const thread = app.rhs.thread.scroller;

    // * Verify the async deletion-report file is in the thread before table headers
    await expect(thread).toContainText(expectedFileName);

    // * Verify the summary table headers are present (rendered as markdown table)
    for (const text of [
        'Step',
        'Status',
        'Detail',
        'File attachments',
        'File attachment records',
        'Edit history',
        'Priority metadata',
        'Persistent notifications',
        'Acknowledgements',
        'Reminders',
        'Thread, replies, and reactions',
        'Post record',
    ]) {
        await expect(thread).toContainText(text);
    }
});
