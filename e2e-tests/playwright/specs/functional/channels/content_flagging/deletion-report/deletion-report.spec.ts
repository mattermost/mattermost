// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, test} from '@mattermost/playwright-lib';

import {setupContentFlagging, createPost} from './../support';

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
    const {app, contentReviewPage} = await pw.testBrowser.login(reviewerUser);
    await app.channelsPage.goto({team, path: 'messages', channel: '@content-review'});
    await expect(app.center.postCreate.message.container).toBeVisible();

    const {client: reviewerClient} = await pw.makeClient(reviewerUser);
    const reportId = await reviewReportId(reviewerClient, post.id);
    const flaggedPost = app.center.postList.post({id: reportId});
    await expect(flaggedPost).toContainText(message);

    // # Remove the post via the UI. The remove flow still routes through the
    // skip-confirm step (destructive action), unlike the keep flow which now
    // bypasses it.
    await flaggedPost.spillageReport.footer.viewDetailsButton.click();
    const rhsReport = app.rhs.thread.post({id: reportId});
    await expect(rhsReport.spillageReport.card).toBeVisible();
    await rhsReport.spillageReport.actions.removeButton.click();
    await expect(contentReviewPage.postActionConformationModal).toBeVisible();
    await contentReviewPage.enterConfirmationComment('Removing: data spillage confirmed');
    await expect(contentReviewPage.confirmationModalComment).toHaveValue('Removing: data spillage confirmed');
    await contentReviewPage.confirmRemoveWithoutReport();
    await expect(contentReviewPage.postActionConformationModal).not.toBeVisible();

    await app.channelsPage.goto({team, path: 'messages', channel: '@content-review'});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // * Verify the removed stub is in the content-review thread
    const removedPost = app.center.postList.post({id: reportId});
    await expect(removedPost).toBeVisible();
    await expect(removedPost).toContainText('Content deleted as part of Content Flagging review process');

    // # Open the thread — the deletion report is posted as a reply, not on the
    // view-details property card.
    await expect(removedPost.threadFooter.container).toBeVisible();
    await removedPost.threadFooter.replyButton.click();
    await expect(app.rhs.thread.scroller).toBeVisible();

    // * Verify the async deletion-report file is in the thread before table headers
    await expect(app.rhs.thread.scroller).toContainText(expectedFileName);

    // * Verify the summary table headers are present (rendered as markdown table)
    await expect(app.rhs.thread.scroller).toContainText('Step');
    await expect(app.rhs.thread.scroller).toContainText('Status');
    await expect(app.rhs.thread.scroller).toContainText('Detail');

    await expect(app.rhs.thread.scroller).toContainText('File attachments');
    await expect(app.rhs.thread.scroller).toContainText('File attachment records');
    await expect(app.rhs.thread.scroller).toContainText('Edit history');
    await expect(app.rhs.thread.scroller).toContainText('Priority metadata');
    await expect(app.rhs.thread.scroller).toContainText('Persistent notifications');
    await expect(app.rhs.thread.scroller).toContainText('Acknowledgements');
    await expect(app.rhs.thread.scroller).toContainText('Reminders');
    await expect(app.rhs.thread.scroller).toContainText('Thread, replies, and reactions');
    await expect(app.rhs.thread.scroller).toContainText('Post record');
});

// Match the review bot's host post through its reported-post identity; keep the native confirmation-modal helpers.
async function reviewReportId(client: Client4, flaggedPostId: string) {
    const me = await client.getMe();
    const bot = await client.getUserByUsername('content-review');
    const dm = await client.createDirectChannel([me.id, bot.id]);
    let id = '';
    await expect
        .poll(async () => {
            const {posts} = await client.getPosts(dm.id, 0, 60);
            id = Object.values(posts).find((post) => post.props?.reported_post_id === flaggedPostId)?.id ?? '';
            return id;
        })
        .not.toBe('');
    return id;
}
